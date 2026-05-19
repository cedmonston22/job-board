// The scrape orchestrator. One entry point — `runScrapeForUser(userId)` —
// invoked by the manual-trigger endpoint (/api/scrape/run, Phase 3.3) and
// later by the daily Vercel Cron (Phase 3.6).
//
// Flow:
//   1. Load the user's ScrapeFilter (one row or null)
//   2. Iterate DEFAULT_SOURCES in parallel via Promise.allSettled
//   3. For each source: pick the adapter, fetch, filter, upsert
//   4. Collect per-source summaries and return
//
// Why parallel? 12 sources × ~1-3 s each = ~30 s serially, well past
// Vercel's default 10 s function timeout. Parallel keeps total runtime
// bounded by the slowest single adapter (~3 s).

import { prisma } from "../prisma";
import type { ScrapeSourceTypeInput } from "../zod-schemas";
import { ashbyAdapter } from "./ashby";
import { deleteStaleDiscoveredJobs } from "./cleanup";
import { DEFAULT_SOURCES, type DefaultSource } from "./default-sources";
import { applyFilter } from "./filter";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ouckahAdapter } from "./ouckah";
import { remoteOkAdapter } from "./remoteok";
import {
  makeSimplifyAdapter,
  SIMPLIFY_NEWGRAD_URL,
  SIMPLIFY_SUMMER_URL,
} from "./simplify";
import type { Adapter, RawJob, RunSummary } from "./types";
import { workdayAdapter } from "./workday";
// Prisma's generated enum value — pass-through to `trigger` field of the
// ScrapeRun row we write at the end of every invocation.
import { ScrapeTrigger } from "../generated/prisma/client";

// Top-level result of a scrape run. `pruned` is how many stale rows were
// removed before fetching new ones; `sources` is the per-source detail.
export type RunResult = {
  pruned: number;
  sources: RunSummary[];
};

// Result of a single source's upstream fetch — either the raw rows OR the
// error message the adapter threw / never-implemented placeholder. Stored
// in a Map keyed by `sourceKey(source)` so per-user passes can read from
// the cache instead of re-hitting the network for every user.
export type PrefetchedSource = {
  raw: RawJob[];
  error: string | null;
};

export type PrefetchedSources = Map<string, PrefetchedSource>;

// Stable cache key for a DEFAULT_SOURCES row. `identifier` is null for
// global feeds (RemoteOK / Simplify / Ouckah) — we coerce to empty string
// so the key is still deterministic. Exported in case future callers want
// to populate the map themselves.
export function sourceKey(source: DefaultSource): string {
  return `${source.type}:${source.identifier ?? ""}`;
}

// Adapter map. All eight source types are wired as of Phase 3.5 (Workday
// added). The map stays Partial so a future enum addition doesn't crash —
// missing entries surface as "adapter not implemented" in the summary.
const ADAPTERS: Partial<Record<ScrapeSourceTypeInput, Adapter>> = {
  GREENHOUSE: greenhouseAdapter,
  LEVER: leverAdapter,
  ASHBY: ashbyAdapter,
  WORKDAY: workdayAdapter,
  REMOTEOK: remoteOkAdapter,
  SIMPLIFY_SUMMER: makeSimplifyAdapter(SIMPLIFY_SUMMER_URL),
  SIMPLIFY_NEWGRAD: makeSimplifyAdapter(SIMPLIFY_NEWGRAD_URL),
  OUCKAH_SUMMER: ouckahAdapter,
};

export async function runScrapeForUser(
  userId: string,
  // Defaults to MANUAL so existing callers (the manual /api/scrape/run
  // endpoint, tests) don't need to change. The cron route passes CRON
  // explicitly. The trigger ends up on the ScrapeRun audit row so the
  // /jobs/search status pill can tell at a glance "last cron 4h ago" vs
  // "last manual 2 min ago" — the difference matters when diagnosing
  // whether the SCHEDULED scrape is firing.
  trigger: ScrapeTrigger = ScrapeTrigger.MANUAL,
  // Optional map of pre-fetched raw rows keyed by `sourceKey(source)`.
  // The cron route populates this once via `fetchAllRawJobs()` and reuses
  // it across every user so each upstream source is hit exactly ONCE per
  // cron run regardless of user count. When undefined (e.g. the manual
  // /api/scrape/run endpoint), each per-source pass falls back to calling
  // the adapter directly — original single-user behavior is preserved.
  prefetched?: PrefetchedSources,
): Promise<RunResult> {
  // Create the audit row up-front in `ok: false` state. Whichever branch
  // we exit through (success / per-source failures / unexpected throw)
  // updates this row at the end. Without the up-front insert, a crash
  // mid-run would leave NO record of the attempt, defeating the whole
  // observability point.
  const auditRow = await prisma.scrapeRun.create({
    data: { userId, trigger, ok: false },
    select: { id: true },
  });

  let pruned = 0;
  let sources: RunSummary[] = [];
  let thrownError: Error | null = null;

  try {
    // Prune first so the run starts with a clean baseline. Cheap (one
    // deleteMany) and idempotent — does nothing if there's nothing stale.
    pruned = await deleteStaleDiscoveredJobs(userId);

    // One round-trip to load the filter. May be null if the user has never
    // touched the filter sidebar — applyFilter handles that.
    const filter = await prisma.scrapeFilter.findUnique({ where: { userId } });

    // Promise.allSettled because we want ALL sources to attempt regardless of
    // any single failure — a 500 from Lever shouldn't block Greenhouse results.
    // When `prefetched` is supplied, runOneSource skips its own fetch and
    // reuses the cached raw rows; otherwise it calls the adapter itself.
    const settled = await Promise.allSettled(
      DEFAULT_SOURCES.map((source) =>
        runOneSource(userId, source, filter, prefetched),
      ),
    );

    // `runOneSource` always resolves with a RunSummary (it catches its own
    // errors and stuffs them into `errored`). The .rejected branch only
    // fires on truly unexpected bugs.
    sources = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      const src = DEFAULT_SOURCES[i];
      return blankSummary(src, `unexpected error: ${String(s.reason)}`);
    });
  } catch (err) {
    // Top-level catch — something outside any single adapter blew up
    // (Prisma down, cleanup query failed, etc.). Capture the error so
    // it lands on the audit row, then re-throw so the caller (cron
    // route / manual endpoint) sees the failure too.
    thrownError = err as Error;
  }

  // Aggregate the per-source numbers for the top-level columns. Best-effort
  // — if the audit-row update itself fails we just log; we never want a
  // logging failure to mask a successful (or already-failed) scrape.
  const agg = aggregateSummaries(sources);
  try {
    await prisma.scrapeRun.update({
      where: { id: auditRow.id },
      data: {
        finishedAt: new Date(),
        ok: thrownError === null,
        errorMessage: thrownError?.message ?? null,
        pruned,
        fetched: agg.fetched,
        kept: agg.kept,
        inserted: agg.inserted,
        updated: agg.updated,
        sourcesOk: agg.sourcesOk,
        sourcesErrored: agg.sourcesErrored,
        // Cast through unknown — Prisma's Json input is `InputJsonValue`
        // and our RunSummary[] is structurally compatible (all primitive
        // leaves) but TS can't prove it without the cast.
        sources: sources as unknown as object[],
      },
    });
  } catch (auditErr) {
    console.error(
      `[scrape] failed to write ScrapeRun audit row ${auditRow.id}:`,
      auditErr,
    );
  }

  if (thrownError) throw thrownError;
  return { pruned, sources };
}

function aggregateSummaries(sources: RunSummary[]): {
  fetched: number;
  kept: number;
  inserted: number;
  updated: number;
  sourcesOk: number;
  sourcesErrored: number;
} {
  return sources.reduce(
    (acc, s) => {
      acc.fetched += s.fetched;
      acc.kept += s.kept;
      acc.inserted += s.inserted;
      acc.updated += s.updated;
      if (s.errored) acc.sourcesErrored += 1;
      else acc.sourcesOk += 1;
      return acc;
    },
    {
      fetched: 0,
      kept: 0,
      inserted: 0,
      updated: 0,
      sourcesOk: 0,
      sourcesErrored: 0,
    },
  );
}

async function runOneSource(
  userId: string,
  source: DefaultSource,
  filter: Awaited<ReturnType<typeof prisma.scrapeFilter.findUnique>>,
  prefetched?: PrefetchedSources,
): Promise<RunSummary> {
  const summary = blankSummary(source, null);

  let raw: RawJob[];

  if (prefetched) {
    // Cron path: the upstream fetch already happened once for this whole
    // run. Read the cached result (raw rows or error) instead of re-hitting
    // the network. A missing entry is treated as an "internal" miss — that
    // shouldn't happen because `fetchAllRawJobs()` populates every source,
    // but the defensive branch keeps a typo from silently zeroing a source.
    const cached = prefetched.get(sourceKey(source));
    if (!cached) {
      summary.errored = "no prefetched entry for source";
      return summary;
    }
    if (cached.error !== null) {
      summary.errored = cached.error;
      return summary;
    }
    raw = cached.raw;
  } else {
    // Manual path: no shared cache — fetch this source ourselves.
    const adapter = ADAPTERS[source.type];

    // Unimplemented adapter — not an error, just nothing to do.
    if (!adapter) {
      summary.errored = "adapter not implemented yet";
      return summary;
    }

    try {
      raw = await adapter(source.identifier, { defaultCompany: source.label });
    } catch (err) {
      summary.errored = (err as Error).message;
      return summary;
    }
  }

  summary.fetched = raw.length;

  const kept = applyFilter(raw, filter);
  summary.kept = kept.length;

  // Upsert one row at a time. We need to distinguish insert vs update for
  // the summary, which requires the findUnique-then-create-or-update
  // pattern (Prisma's upsert returns the row but not a "was new" flag).
  // For ~50-200 jobs total per run, the extra queries are fine.
  for (const job of kept) {
    try {
      const wasInserted = await upsertDiscoveredJob(userId, source.type, job);
      if (wasInserted) summary.inserted++;
      else summary.updated++;
    } catch (err) {
      // Per-row failure is rare (e.g. unique violation on a race) — log,
      // count via `errored` field as a partial-failure flag, keep going.
      console.error(
        `[scrape] ${source.label}: failed to upsert ${job.sourceId}:`,
        err,
      );
      summary.errored = summary.errored
        ? `${summary.errored}; row upsert failed`
        : `row upsert failed for ${job.sourceId}`;
    }
  }

  return summary;
}

// Returns true if a new row was inserted, false if an existing row was
// updated. Mutable content fields (title/location/description/postedAt/url)
// get refreshed on every run so the search tab always reflects the current
// posting. Bookkeeping fields (discoveredAt, importedJobId, dismissedAt)
// are never touched on update.
async function upsertDiscoveredJob(
  userId: string,
  source: ScrapeSourceTypeInput,
  job: RawJob,
): Promise<boolean> {
  const existing = await prisma.discoveredJob.findUnique({
    where: {
      userId_source_sourceId: { userId, source, sourceId: job.sourceId },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.discoveredJob.update({
      where: { id: existing.id },
      data: {
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        description: job.description,
        postedAt: job.postedAt,
      },
    });
    return false;
  }

  await prisma.discoveredJob.create({
    data: {
      userId,
      source,
      sourceId: job.sourceId,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      postedAt: job.postedAt,
    },
  });
  return true;
}

function blankSummary(
  source: DefaultSource,
  errored: string | null,
): RunSummary {
  return {
    source: source.type,
    label: source.label,
    fetched: 0,
    kept: 0,
    inserted: 0,
    updated: 0,
    errored,
  };
}

// Fetch every DEFAULT_SOURCES adapter exactly once and return the raw rows
// keyed by `sourceKey(source)`. The cron route calls this ONCE per
// invocation, then hands the resulting map to each `runScrapeForUser` call
// so per-user passes only run prune + filter + upsert (cheap, DB-bound) and
// never re-hit the upstream APIs.
//
// Behavior parity with the per-user fetch in `runOneSource`:
//   - Promise.allSettled so one bad source doesn't block the others
//   - missing adapter → error entry "adapter not implemented yet"
//   - adapter throws → error entry with the thrown message
//   - unexpected rejection (shouldn't happen — the per-source closure catches
//     its own throws) → error entry "unexpected error: ..."
// Errors are carried in the same map entry as `{ raw: [], error: msg }`, so
// downstream per-user runs surface them in `RunSummary.errored` exactly the
// way they would if the user-loop had fetched directly.
export async function fetchAllRawJobs(): Promise<PrefetchedSources> {
  const settled = await Promise.allSettled(
    DEFAULT_SOURCES.map(async (source): Promise<PrefetchedSource> => {
      const adapter = ADAPTERS[source.type];
      if (!adapter) {
        return { raw: [], error: "adapter not implemented yet" };
      }
      try {
        const raw = await adapter(source.identifier, {
          defaultCompany: source.label,
        });
        return { raw, error: null };
      } catch (err) {
        return { raw: [], error: (err as Error).message };
      }
    }),
  );

  const out: PrefetchedSources = new Map();
  settled.forEach((s, i) => {
    const source = DEFAULT_SOURCES[i];
    if (s.status === "fulfilled") {
      out.set(sourceKey(source), s.value);
    } else {
      // Inner closure catches everything; reaching this branch means a
      // truly unexpected bug. Surface it just like the per-user path does.
      out.set(sourceKey(source), {
        raw: [],
        error: `unexpected error: ${String(s.reason)}`,
      });
    }
  });
  return out;
}
