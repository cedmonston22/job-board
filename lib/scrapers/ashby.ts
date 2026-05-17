// Ashby adapter — fetches openings from a single company's Ashby board.
// No API key needed.
//
// Endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}
// Response shape (relevant fields):
//   { jobs: [ { id (UUID), title, location (string), publishedAt (ISO),
//               jobUrl, applyUrl, descriptionHtml, isListed (bool),
//               employmentType, workplaceType }, ... ] }
//
// We filter `isListed: true` so unlisted/draft postings don't leak through.

import { z } from "zod";
import { htmlToText } from "../html-to-text";
import type { Adapter, RawJob } from "./types";

const ashbyJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  jobUrl: z.string().url(),
  applyUrl: z.string().url().nullable().optional(),
  descriptionHtml: z.string().nullable().optional(),
  // Ashby returns isListed for every job in our experience, but tolerate
  // missing/null to be safe — we default to `true` (include).
  isListed: z.boolean().nullable().optional(),
});

const ashbyResponseSchema = z.object({
  jobs: z.array(ashbyJobSchema),
});

const FETCH_TIMEOUT_MS = 15_000;
const MAX_DESCRIPTION_CHARS = 2_000;

export const ashbyAdapter: Adapter = async (identifier, ctx) => {
  if (!identifier) {
    throw new Error("Ashby requires a company slug");
  }

  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
    identifier,
  )}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(
      `Ashby fetch failed for "${identifier}": ${(err as Error).message}`,
    );
  }

  if (res.status === 404) {
    throw new Error(
      `Ashby: board "${identifier}" not found (404). Verify the slug.`,
    );
  }
  if (!res.ok) {
    throw new Error(`Ashby: HTTP ${res.status} for board "${identifier}"`);
  }

  const json = (await res.json()) as unknown;
  const parsed = ashbyResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Ashby: unexpected response shape for "${identifier}"`);
  }

  return parsed.data.jobs
    // Skip explicitly unlisted jobs. Treat missing/null as listed
    // (defensive: better to include borderline rows than silently drop).
    .filter((job) => job.isListed !== false)
    .map<RawJob>((job) => ({
      sourceId: job.id,
      title: job.title,
      company: ctx.defaultCompany,
      location: job.location ?? null,
      url: job.jobUrl,
      description: job.descriptionHtml
        ? htmlToText(job.descriptionHtml).slice(0, MAX_DESCRIPTION_CHARS)
        : null,
      postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    }));
};
