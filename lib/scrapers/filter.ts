// Title-based relevance filter applied at scrape time. Cheap, pure function
// — no DB calls, no async. Same logic will also be applied at READ time on
// the /jobs/search page so the user can change their major/roles without
// re-running every adapter.
//
// Precedence (locked in Phase 3.1):
//   1. roles[] non-empty  → keep jobs whose title contains ANY listed role
//   2. major set          → keep jobs whose title contains ANY of the
//                           MAJOR_KEYWORDS for that major
//   3. neither            → keep everything (no filter configured)

import { MAJOR_KEYWORDS, type Major } from "../major-keywords";
import type { ScrapeFilter } from "../generated/prisma/client";

// Anything with a `title` field. RawJob (from adapters) and DiscoveredJob
// (from the DB) both qualify, so the scrape pipeline AND the read-side
// /jobs/search page share one filter implementation.
type Titled = { title: string };

export function applyFilter<T extends Titled>(
  jobs: T[],
  filter: ScrapeFilter | null,
): T[] {
  // No filter row yet (user never visited the sidebar) → save everything.
  if (!filter) return jobs;

  const titleOf = (j: Titled) => j.title.toLowerCase();

  // Override path — explicit roles trump the major umbrella.
  if (filter.roles.length > 0) {
    const needles = filter.roles.map((r) => r.toLowerCase());
    return jobs.filter((j) => {
      const title = titleOf(j);
      return needles.some((n) => title.includes(n));
    });
  }

  // Umbrella path — expand the major into its keyword list.
  if (filter.major) {
    // The DB stores `major` as `String?` (we keep the schema loose so adding
    // new majors is just an entry in MAJOR_KEYWORDS, not a Postgres enum
    // migration). Cast through Major; defensively bail to "keep everything"
    // if the value isn't in our lookup.
    const keywords = MAJOR_KEYWORDS[filter.major as Major];
    if (!keywords) return jobs;
    return jobs.filter((j) => {
      const title = titleOf(j);
      return keywords.some((k) => title.includes(k));
    });
  }

  // Filter row exists but is empty → save everything.
  return jobs;
}
