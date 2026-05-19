// Workday adapter — fetches openings from a company's Workday-hosted careers
// site. No API key needed; Workday's CXS (Candidate Experience) endpoints
// are publicly accessible POST endpoints that back the public careers pages.
//
// Endpoint pattern (tenant-specific):
//   POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
// where `N` is a small datacenter number (1, 3, 5, 10, 12, ...) that varies
// per tenant. The `identifier` we pass through DEFAULT_SOURCES encodes all
// three parts in a single slash-delimited string: "{tenant}/wd{N}/{site}",
// e.g. "target/wd5/External". We parse that here.
//
// Request body uses Workday's "appliedFacets" search format. We pass an
// empty facets object + a paging window. Workday returns at most 20 jobs
// per call regardless of what `limit` we ask for (their cap, not ours), so
// we paginate by bumping offset += 20 until we hit an empty page or the
// safety cap. The cap exists because a runaway tenant (e.g. a Fortune 500
// with 10k openings) would otherwise blow past the Vercel function budget
// AND bloat DiscoveredJob with jobs the user will never see anyway.
// Workday returns newest postings first, so capping at the top preserves
// freshness.
//
// Description handling: Workday does NOT return full descriptions in the
// listing API — they're only available via a per-job CXS endpoint
// (.../jobs/{externalPath}). That's N+1 round-trips per tenant which we
// don't want. We leave description=null; the fit scorer's JSON-LD fallback
// in lib/fetch-job-description.ts hydrates descriptions on-demand at score
// time. Net effect: descriptions land in DiscoveredJob ONLY for jobs the
// user actually opens. Good for DB size, slightly slower fit scoring.

import { z } from "zod";
import type { Adapter, RawJob } from "./types";

// Workday's listing-API response. We only validate the fields we actually
// use; Workday returns 20+ keys per posting that we don't care about.
//
// title and externalPath are tolerated as optional/null even though they're
// always present in practice on healthy postings — empirically (e.g.
// Walmart's WalmartExternal site) the API occasionally returns sparse
// rows missing `title`. Rather than fail the whole batch, we filter
// those out below.
const workdayJobPostingSchema = z.object({
  title: z.string().nullable().optional(),
  // Relative path from the tenant base, e.g.
  // "/en-US/External/job/Minneapolis/Software-Engineer_R0000123".
  // We resolve this to a full URL below.
  externalPath: z.string().nullable().optional(),
  // Pre-formatted location string ("Minneapolis, MN" / "Remote, USA" /
  // "Multiple Locations"). Workday also exposes structured `locations[]`
  // but locationsText is what their own UI renders, so it's good enough.
  locationsText: z.string().nullable().optional(),
  // Human-readable like "Posted 3 Days Ago" / "Posted Yesterday" /
  // "Posted Today" / "Posted 30+ Days Ago". We parse this best-effort
  // and fall back to null — not worth being clever about edge cases.
  postedOn: z.string().nullable().optional(),
  // Stable per-tenant id. Format varies (e.g. "R0000123", "JR12345");
  // treated as opaque string.
  bulletFields: z.array(z.string()).nullable().optional(),
});

const workdayResponseSchema = z.object({
  // `total` is unreliable across pages (see workdayAdapter pagination
  // comment); kept optional in the schema purely for response shape
  // documentation. We never consume it.
  total: z.number().nullable().optional(),
  jobPostings: z.array(workdayJobPostingSchema),
});

const FETCH_TIMEOUT_MS = 15_000;
// Workday hard-caps listing-API responses to 20 per request. Larger limits
// are silently ignored. Don't bother asking for more.
const PAGE_SIZE = 20;
// Safety cap. At 20/page that's 10 round-trips per tenant ≈ ~20s for a
// fully-saturated tenant (Walmart, capping at ~2s/page from local probes).
// The Vercel cron route is capped at 60s total (see
// app/api/cron/scrape/route.ts) and adapters run in parallel via
// Promise.allSettled, so the bound is "slowest single adapter ≤ 60s".
// 200 keeps the worst case well under that ceiling while still giving us
// the freshest openings (Workday lists newest first). A Fortune 500 with
// 5k openings would otherwise spawn 250+ requests per scrape run.
const MAX_JOBS_PER_TENANT = 200;

// Parses "target/wd5/External" → { tenant: "target", wdN: "wd5", site: "External" }.
// Throws on malformed input so a typo in default-sources.ts surfaces as an
// adapter error rather than a silent 404.
function parseWorkdayIdentifier(identifier: string): {
  tenant: string;
  wdN: string;
  site: string;
} {
  const parts = identifier.split("/");
  if (parts.length !== 3) {
    throw new Error(
      `Workday identifier "${identifier}" must be "tenant/wdN/site" (3 slash-delimited parts)`,
    );
  }
  const [tenant, wdN, site] = parts;
  if (!tenant || !wdN || !site) {
    throw new Error(
      `Workday identifier "${identifier}" has empty segment(s)`,
    );
  }
  if (!/^wd\d+$/.test(wdN)) {
    throw new Error(
      `Workday identifier "${identifier}": middle segment "${wdN}" must be wd<digits> (e.g. wd5)`,
    );
  }
  return { tenant, wdN, site };
}

// Best-effort parse of "Posted 3 Days Ago" / "Posted Yesterday" / "Posted
// Today" / "Posted 30+ Days Ago" → a Date roughly N days back from now.
// Returns null when the string doesn't match any pattern we know.
function parsePostedOn(postedOn: string | null | undefined): Date | null {
  if (!postedOn) return null;
  const text = postedOn.trim().toLowerCase();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1_000;

  if (text.includes("today")) return new Date(now);
  if (text.includes("yesterday")) return new Date(now - DAY_MS);

  // "posted 3 days ago" / "posted 30+ days ago".
  const daysMatch = text.match(/(\d+)\s*\+?\s*days?\s*ago/);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    if (Number.isFinite(days)) return new Date(now - days * DAY_MS);
  }

  // "posted 2 months ago" — coarse but better than nothing.
  const monthsMatch = text.match(/(\d+)\s*\+?\s*months?\s*ago/);
  if (monthsMatch) {
    const months = Number(monthsMatch[1]);
    if (Number.isFinite(months)) return new Date(now - months * 30 * DAY_MS);
  }

  return null;
}

// Derive a stable per-job source id from the externalPath. The path ends
// in the tenant's own job id (e.g. ".../Software-Engineer_R0000123"); the
// chunk after the final underscore is the stable id. If we can't find one,
// fall back to the full path — still unique per posting within a tenant.
function deriveSourceId(externalPath: string): string {
  // Strip trailing slash, take final segment.
  const segments = externalPath.replace(/\/+$/, "").split("/");
  const lastSegment = segments[segments.length - 1] ?? externalPath;
  // Most tenants format as "Job-Title_R0000123". Take the trailing
  // underscore-prefixed token if present.
  const underscoreIdx = lastSegment.lastIndexOf("_");
  if (underscoreIdx >= 0 && underscoreIdx < lastSegment.length - 1) {
    return lastSegment.slice(underscoreIdx + 1);
  }
  return lastSegment || externalPath;
}

export const workdayAdapter: Adapter = async (identifier, ctx) => {
  if (!identifier) {
    throw new Error("Workday requires an identifier (tenant/wdN/site)");
  }

  const { tenant, wdN, site } = parseWorkdayIdentifier(identifier);

  const baseUrl = `https://${tenant}.${wdN}.myworkdayjobs.com`;
  const apiUrl = `${baseUrl}/wday/cxs/${tenant}/${site}/jobs`;
  // External-facing careers URL pattern used to resolve externalPath into
  // a clickable apply URL. Workday's externalPath is already locale-
  // prefixed (e.g. "/en-US/External/..."), so we just concatenate.
  const siteBaseUrl = `https://${tenant}.${wdN}.myworkdayjobs.com`;

  const collected: RawJob[] = [];
  let offset = 0;

  // Paginate until we hit an empty page OR the safety cap. We do NOT trust
  // `total` from the response across pages — Workday's CXS API has been
  // observed (e.g. Walmart) to return total=N on the first request and
  // total=0 on subsequent requests from the same client (their backend
  // appears to gate "search context" by session/cookie). Relying on
  // `total` would cap us at page 1 + page 2. The empty-page check below
  // is the real terminator.
  while (collected.length < MAX_JOBS_PER_TENANT) {
    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: PAGE_SIZE,
          offset,
          searchText: "",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(
        `Workday fetch failed for "${identifier}" at offset ${offset}: ${(err as Error).message}`,
      );
    }

    if (res.status === 404) {
      throw new Error(
        `Workday: tenant "${identifier}" not found (404). Verify tenant/wdN/site.`,
      );
    }
    if (!res.ok) {
      throw new Error(
        `Workday: HTTP ${res.status} for tenant "${identifier}" at offset ${offset}`,
      );
    }

    const json = (await res.json()) as unknown;
    const parsed = workdayResponseSchema.safeParse(json);
    if (!parsed.success) {
      // Include the first zod issue path/message so a malformed posting
      // doesn't just hide behind a generic error string.
      const firstIssue = parsed.error.issues[0];
      const issueText = firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "no issue detail";
      throw new Error(
        `Workday: unexpected response shape for "${identifier}" at offset ${offset} (${issueText})`,
      );
    }

    // Empty page = stop. This is our only terminator (see while-loop
    // comment above for why we don't use response.total).
    if (parsed.data.jobPostings.length === 0) break;

    for (const job of parsed.data.jobPostings) {
      // Skip rows missing the essentials. Workday occasionally returns
      // sparse postings (no title or no externalPath) — likely placeholder
      // /draft rows that shouldn't surface in our search.
      if (!job.title || !job.externalPath) continue;

      collected.push({
        sourceId: deriveSourceId(job.externalPath),
        title: job.title,
        company: ctx.defaultCompany,
        location: job.locationsText ?? null,
        // externalPath is root-relative — concat with the tenant base.
        url: `${siteBaseUrl}${job.externalPath}`,
        // See header comment: descriptions are intentionally null. The fit
        // scorer hydrates them per-job from JSON-LD when needed.
        description: null,
        postedAt: parsePostedOn(job.postedOn),
      });

      if (collected.length >= MAX_JOBS_PER_TENANT) break;
    }

    offset += PAGE_SIZE;
  }

  return collected;
};
