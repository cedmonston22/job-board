// Greenhouse adapter — fetches openings from a single company's public
// board JSON. No API key required.
//
// Endpoint: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
// Response shape (relevant fields):
//   { jobs: [ { id, title, absolute_url, updated_at,
//               location: { name }, content: HTML string }, ... ] }
// The `?content=true` query parameter asks Greenhouse to embed the full HTML
// description in each job. Without it we'd need a second round-trip per job.

import { z } from "zod";
import { htmlToText } from "../html-to-text";
import type { Adapter, RawJob } from "./types";

const greenhouseJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string().url(),
  // Some boards omit updated_at; tolerate missing/null.
  updated_at: z.string().nullable().optional(),
  // location may be null (e.g. unspecified) or `{ name: null }`.
  location: z
    .object({ name: z.string().nullable() })
    .nullable()
    .optional(),
  // Present only when ?content=true. HTML string.
  content: z.string().nullable().optional(),
  // Some boards include a per-job company name (multi-brand orgs); fall back
  // to the configured default when absent.
  company_name: z.string().nullable().optional(),
});

const greenhouseResponseSchema = z.object({
  jobs: z.array(greenhouseJobSchema),
});

// 15s timeout — Greenhouse's API is usually <1s but we don't want a hung
// request to block the whole scrape run.
const FETCH_TIMEOUT_MS = 15_000;

// Cap description length to keep DB rows reasonable. Job Search shows only
// a short preview; the full text is one click away at the apply URL. At
// 2 KB per description, each DiscoveredJob row is ~2.3 KB total (vs. ~5.3
// KB at the old 5 KB cap) — meaningful savings as the table grows.
const MAX_DESCRIPTION_CHARS = 2_000;

export const greenhouseAdapter: Adapter = async (identifier, ctx) => {
  // The schema guarantees identifier is non-null for ATS sources by the time
  // the runner dispatches us, but type the param permissively per the
  // Adapter contract.
  if (!identifier) {
    throw new Error("Greenhouse requires a company slug");
  }

  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    identifier,
  )}/jobs?content=true`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        accept: "application/json",
        // Identifying user-agent — Greenhouse doesn't block default agents
        // but it's polite (and helps if they ever start rate-limiting).
        "user-agent":
          "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    // Network error, DNS failure, timeout — surface as adapter failure so
    // the runner records `errored` and continues with the next source.
    throw new Error(
      `Greenhouse fetch failed for "${identifier}": ${(err as Error).message}`,
    );
  }

  if (res.status === 404) {
    // Most common cause of a P-100 outage: bad slug. Surface clearly.
    throw new Error(
      `Greenhouse: board "${identifier}" not found (404). Verify the slug.`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Greenhouse: HTTP ${res.status} for board "${identifier}"`,
    );
  }

  // Parse + validate. Network success but malformed body still throws so
  // the runner reports it as a per-source error rather than silently
  // returning [].
  const json = (await res.json()) as unknown;
  const parsed = greenhouseResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Greenhouse: unexpected response shape for "${identifier}"`,
    );
  }

  return parsed.data.jobs.map<RawJob>((job) => ({
    sourceId: String(job.id),
    title: job.title,
    company: job.company_name ?? ctx.defaultCompany,
    location: job.location?.name ?? null,
    url: job.absolute_url,
    description: job.content
      ? htmlToText(job.content).slice(0, MAX_DESCRIPTION_CHARS)
      : null,
    postedAt: job.updated_at ? new Date(job.updated_at) : null,
  }));
};

