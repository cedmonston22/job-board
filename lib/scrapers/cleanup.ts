// Stale-lead cleanup. Runs at the start of every scrape via the runner, so
// you don't have to remember to trigger it separately.
//
// Policy: delete a DiscoveredJob row when ALL of these are true:
//   1. It's more than 6 months old (by `postedAt` if set, otherwise
//      `discoveredAt` as a fallback for sources that don't expose a posted
//      date — e.g. Simplify / Ouckah markdown lists).
//   2. The user hasn't imported it (`importedJobId IS NULL`).
//   3. The user hasn't dismissed it (`dismissedAt IS NULL`).
//
// Rows the user has actively engaged with (imported or dismissed) are
// preserved as history regardless of age. The "old AND ignored" intersection
// is what we sweep.

import { prisma } from "../prisma";

// 6 months in days. Calendar months vary (28–31), but six months ≈ 182.5
// days for cleanup purposes is plenty close enough — we're not billing on
// it. Avoids pulling in date-fns just for this one calculation.
//
// Exported so the search page can reuse the same threshold when filtering
// "posted within 6 months" at read time. Single source of truth for the
// freshness window.
export const STALE_AFTER_DAYS = 183;

export function getStaleCutoff(): Date {
  return new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
}

export async function deleteStaleDiscoveredJobs(
  userId: string,
): Promise<number> {
  const cutoff = getStaleCutoff();

  // Prisma's deleteMany returns { count } — total rows deleted, which is
  // what the runner reports in its summary.
  //
  // The OR clause covers the postedAt-fallback rule:
  //   - postedAt is set AND older than cutoff      → stale
  //   - postedAt is null AND discoveredAt < cutoff → stale (no posted date
  //                                                   to use, fall back to
  //                                                   when WE first saw it)
  const result = await prisma.discoveredJob.deleteMany({
    where: {
      userId,
      importedJobId: null,
      dismissedAt: null,
      OR: [
        { postedAt: { lt: cutoff } },
        { AND: [{ postedAt: null }, { discoveredAt: { lt: cutoff } }] },
      ],
    },
  });

  return result.count;
}
