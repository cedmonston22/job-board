// Shared types used across every scraper adapter and the runner.
//
// `RawJob` is the normalized shape every adapter returns — the runner upserts
// these into the DiscoveredJob table without caring which source produced
// them. Keep this shape minimal: just the fields DiscoveredJob has columns
// for. If you need more context (e.g. source-specific tags), add a column
// first and update this type.

import type { ScrapeSourceTypeInput } from "../zod-schemas";

export type RawJob = {
  // Stable external identifier — used as the upsert key (along with userId +
  // source). For ATS APIs this is the job's numeric id; for markdown lists
  // it's a hash of the apply URL.
  sourceId: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string | null;
  postedAt: Date | null;
};

// Context the runner hands to each adapter. `defaultCompany` is the label
// from DEFAULT_SOURCES — ATS adapters use it because their API responses
// often omit company name. Global feeds ignore it (their per-row data has
// the company directly).
export type AdapterContext = {
  defaultCompany: string;
};

// Every adapter implements this signature. `identifier` is the company slug
// for ATS sources, or `null` for global feeds. Throw on hard failure
// (network error, malformed response); the runner catches and reports.
export type Adapter = (
  identifier: string | null,
  ctx: AdapterContext,
) => Promise<RawJob[]>;

// Per-source summary returned by the runner. `errored` is null on success,
// or a short error message string on failure. `upserted` counts all writes
// (insert + update); split into `inserted` vs `updated` for visibility.
export type RunSummary = {
  source: ScrapeSourceTypeInput;
  label: string;
  fetched: number; // total returned by adapter
  kept: number; // passed the filter
  inserted: number; // newly added to DiscoveredJob
  updated: number; // already existed; content refreshed
  errored: string | null;
};
