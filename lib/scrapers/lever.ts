// Lever adapter — fetches openings from a single company's public Lever
// board. No API key needed.
//
// Endpoint: https://api.lever.co/v0/postings/{slug}?mode=json
// Response: top-level array of postings (NOT wrapped in `{ jobs: [...] }`
// like Greenhouse/Ashby). Per-posting fields (relevant subset):
//   { id (UUID string), text (= title), createdAt (Unix ms),
//     categories: { location, commitment, team }, hostedUrl, applyUrl,
//     descriptionPlain (no HTML), workplaceType }
//
// 404 = company isn't on Lever (or moved). The verbose error body sometimes
// returned (`{"ok":false,"error":"Document not found"}`) also signals a
// dead slug — we treat any non-array response as malformed.

import { z } from "zod";
import type { Adapter, RawJob } from "./types";

const leverPostingSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.number().nullable().optional(),
  hostedUrl: z.string().url(),
  applyUrl: z.string().url().nullable().optional(),
  categories: z
    .object({
      location: z.string().nullable().optional(),
      commitment: z.string().nullable().optional(),
      team: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  descriptionPlain: z.string().nullable().optional(),
});

// Response is a top-level array. Validate as such.
const leverResponseSchema = z.array(leverPostingSchema);

const FETCH_TIMEOUT_MS = 15_000;
const MAX_DESCRIPTION_CHARS = 2_000;

export const leverAdapter: Adapter = async (identifier, ctx) => {
  if (!identifier) {
    throw new Error("Lever requires a company slug");
  }

  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(
    identifier,
  )}?mode=json`;

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
      `Lever fetch failed for "${identifier}": ${(err as Error).message}`,
    );
  }

  if (res.status === 404) {
    throw new Error(
      `Lever: board "${identifier}" not found (404). Verify the slug.`,
    );
  }
  if (!res.ok) {
    throw new Error(`Lever: HTTP ${res.status} for board "${identifier}"`);
  }

  const json = (await res.json()) as unknown;
  const parsed = leverResponseSchema.safeParse(json);
  if (!parsed.success) {
    // Lever sometimes returns `{"ok":false,"error":"..."}` for dead slugs
    // even with a 200 status — falls through to the parse failure.
    throw new Error(
      `Lever: unexpected response shape for "${identifier}" (likely a dead slug)`,
    );
  }

  return parsed.data.map<RawJob>((p) => ({
    sourceId: p.id,
    title: p.text,
    company: ctx.defaultCompany,
    location: p.categories?.location ?? null,
    url: p.hostedUrl,
    description: p.descriptionPlain
      ? p.descriptionPlain.slice(0, MAX_DESCRIPTION_CHARS)
      : null,
    // Lever's createdAt is Unix milliseconds. Convert to Date.
    postedAt: p.createdAt ? new Date(p.createdAt) : null,
  }));
};
