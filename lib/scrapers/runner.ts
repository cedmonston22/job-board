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

// Top-level result of a scrape run. `pruned` is how many stale rows were
// removed before fetching new ones; `sources` is the per-source detail.
export type RunResult = {
  pruned: number;
  sources: RunSummary[];
};

// Adapter map. All seven source types are wired as of Phase 3.4. The map
// stays Partial so a future enum addition (e.g. Workday) doesn't crash —
// missing entries surface as "adapter not implemented" in the summary.
const ADAPTERS: Partial<Record<ScrapeSourceTypeInput, Adapter>> = {
  GREENHOUSE: greenhouseAdapter,
  LEVER: leverAdapter,
  ASHBY: ashbyAdapter,
  REMOTEOK: remoteOkAdapter,
  SIMPLIFY_SUMMER: makeSimplifyAdapter(SIMPLIFY_SUMMER_URL),
  SIMPLIFY_NEWGRAD: makeSimplifyAdapter(SIMPLIFY_NEWGRAD_URL),
  OUCKAH_SUMMER: ouckahAdapter,
};

export async function runScrapeForUser(userId: string): Promise<RunResult> {
  // Prune first so the run starts with a clean baseline. Cheap (one
  // deleteMany) and idempotent — does nothing if there's nothing stale.
  const pruned = await deleteStaleDiscoveredJobs(userId);

  // One round-trip to load the filter. May be null if the user has never
  // touched the filter sidebar — applyFilter handles that.
  const filter = await prisma.scrapeFilter.findUnique({ where: { userId } });

  // Promise.allSettled because we want ALL sources to attempt regardless of
  // any single failure — a 500 from Lever shouldn't block Greenhouse results.
  const settled = await Promise.allSettled(
    DEFAULT_SOURCES.map((source) => runOneSource(userId, source, filter)),
  );

  // `runOneSource` always resolves with a RunSummary (it catches its own
  // errors and stuffs them into `errored`). The .rejected branch only
  // fires on truly unexpected bugs.
  const sources = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const src = DEFAULT_SOURCES[i];
    return blankSummary(src, `unexpected error: ${String(s.reason)}`);
  });

  return { pruned, sources };
}

async function runOneSource(
  userId: string,
  source: DefaultSource,
  filter: Awaited<ReturnType<typeof prisma.scrapeFilter.findUnique>>,
): Promise<RunSummary> {
  const summary = blankSummary(source, null);
  const adapter = ADAPTERS[source.type];

  // Unimplemented adapter — not an error, just nothing to do.
  if (!adapter) {
    summary.errored = "adapter not implemented yet";
    return summary;
  }

  let raw: RawJob[];
  try {
    raw = await adapter(source.identifier, { defaultCompany: source.label });
  } catch (err) {
    summary.errored = (err as Error).message;
    return summary;
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
