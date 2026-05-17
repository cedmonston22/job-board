// RemoteOK adapter — fetches the global remote-jobs firehose.
//
// Endpoint: https://remoteok.com/api
// Response: top-level array. **Index 0 is a metadata object**
// (`{ last_updated, legal }`) which we must skip. Index 1+ are jobs:
//   { id (string), slug, position (= title), company, date (ISO),
//     description (HTML), location ("" when not specified), apply_url,
//     url (canonical), salary_min, salary_max, tags }
//
// Note: RemoteOK's ToS asks for attribution + a backlink when re-publishing.
// We're a personal job tracker (not republishing), but the user-agent
// identifies us anyway.
//
// `identifier` is ignored — RemoteOK is a single global feed, not per-company.

import { z } from "zod";
import { htmlToText } from "../html-to-text";
import type { Adapter, RawJob } from "./types";

// Metadata row (index 0). Just two fields we care about distinguishing —
// the presence of `legal` is the discriminator.
const remoteOkMetaSchema = z.object({
  legal: z.string(),
});

const remoteOkJobSchema = z.object({
  id: z.string(),
  position: z.string(),
  company: z.string(),
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  // RemoteOK uses "" for missing location, not null.
  location: z.string().nullable().optional(),
  // Either field can be the canonical URL; apply_url is more reliable.
  apply_url: z.string().url().nullable().optional(),
  url: z.string().url().nullable().optional(),
});

// The top-level shape is heterogeneous — first element is metadata, the
// rest are jobs. Use z.array(z.unknown()) and discriminate at runtime.
const remoteOkResponseSchema = z.array(z.unknown());

const FETCH_TIMEOUT_MS = 20_000; // RemoteOK can be a bit slow
const MAX_DESCRIPTION_CHARS = 2_000;

export const remoteOkAdapter: Adapter = async () => {
  const url = "https://remoteok.com/api";

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        accept: "application/json",
        // RemoteOK 403s requests without a real user-agent.
        "user-agent":
          "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`RemoteOK fetch failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new Error(`RemoteOK: HTTP ${res.status}`);
  }

  const json = (await res.json()) as unknown;
  const arrParsed = remoteOkResponseSchema.safeParse(json);
  if (!arrParsed.success) {
    throw new Error("RemoteOK: response was not a JSON array");
  }

  const out: RawJob[] = [];
  for (const entry of arrParsed.data) {
    // Skip the metadata row (it's the one with a `legal` field).
    if (remoteOkMetaSchema.safeParse(entry).success) continue;

    const parsed = remoteOkJobSchema.safeParse(entry);
    if (!parsed.success) continue; // tolerate individual bad rows

    const job = parsed.data;
    // Prefer apply_url, fall back to url. If neither exists, skip — we
    // can't show the user a "Open posting" link without one.
    const targetUrl = job.apply_url ?? job.url;
    if (!targetUrl) continue;

    out.push({
      sourceId: job.id,
      title: job.position,
      company: job.company,
      // "" → null for the display column.
      location: job.location && job.location.trim() ? job.location : null,
      url: targetUrl,
      description: job.description
        ? htmlToText(job.description).slice(0, MAX_DESCRIPTION_CHARS)
        : null,
      postedAt: job.date ? new Date(job.date) : null,
    });
  }

  return out;
};
