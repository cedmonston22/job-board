import { prisma } from "@/lib/prisma";
import { requireOnboarded } from "@/lib/require-onboarded";
import { MAJOR_KEYWORDS, type Major } from "@/lib/major-keywords";
import { getStaleCutoff } from "@/lib/scrapers/cleanup";
import { Header } from "@/components/header";
import { SearchView } from "@/components/search/search-view";
import type { Prisma } from "@/lib/generated/prisma/client";

// /jobs/search — the scraped-leads tab.
//
// Server-side paginated. URL params drive everything:
//   ?page=N      page index (1-based, default 1)
//   ?q=...       global search across title/company/location
//   ?sort=...    "newest" (default) or "oldest" — orders by postedAt
//
// Saved filter (Major + Role) lives on the user's ScrapeFilter row and
// is applied at the DB level — keywords are pushed into the Prisma where
// clause so pagination counts are accurate.
//
// Why server pagination: the unfiltered dataset is 3-5K rows × ~2 KB each.
// Fetching all on every navigation made the page sluggish; now we fetch
// at most PAGE_SIZE rows per render, never including the description
// column (the table doesn't display it).

const PAGE_SIZE = 50;

export default async function JobSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  const session = await requireOnboarded();
  const user = session.user;

  // Parse URL params with safe defaults. NaN/<1 → page 1.
  const params = await searchParams;
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const q = params.q?.trim() ?? "";
  const sort: "newest" | "oldest" =
    params.sort === "oldest" ? "oldest" : "newest";

  // Load the user's saved filter first — we need its major/roles to build
  // the where clause for the leads query.
  const filter = await prisma.scrapeFilter.findUnique({
    where: { userId: user.id },
  });

  // Translate the filter into a keyword list. Same precedence as the
  // in-memory applyFilter (which still exists for the scrape runner):
  // roles override the major umbrella.
  const keywords: readonly string[] =
    filter && filter.roles.length > 0
      ? filter.roles
      : filter?.major
        ? (MAJOR_KEYWORDS[filter.major as Major] ?? [])
        : [];

  const cutoff = getStaleCutoff();

  // Build the where clause. AND-combines three independent OR groups so
  // they don't trample each other. Using a typed `Prisma.DiscoveredJobWhereInput`
  // catches mistakes early.
  const andClauses: Prisma.DiscoveredJobWhereInput[] = [
    // 6-month freshness: postedAt null or recent.
    { OR: [{ postedAt: null }, { postedAt: { gte: cutoff } }] },
  ];

  if (keywords.length > 0) {
    // Title must contain ANY keyword (case-insensitive substring).
    andClauses.push({
      OR: keywords.map((k) => ({
        title: { contains: k, mode: "insensitive" as const },
      })),
    });
  }

  if (q) {
    // Global search box — match title OR company OR location.
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
        { location: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }

  const where: Prisma.DiscoveredJobWhereInput = {
    userId: user.id,
    dismissedAt: null,
    AND: andClauses,
  };

  // Parallel: total count for pagination UI + the actual page slice +
  // the user's existing Jobs (for the "In Your Jobs" badge match).
  const [total, leads, existingJobs] = await Promise.all([
    prisma.discoveredJob.count({ where }),
    prisma.discoveredJob.findMany({
      where,
      orderBy: { postedAt: sort === "newest" ? "desc" : "asc" },
      take: PAGE_SIZE,
      skip: (pageNum - 1) * PAGE_SIZE,
      // Explicit select to OMIT description — saves ~80% of payload
      // since the table never renders it. If we ever surface description
      // inline, fetch it lazily via a per-row server action.
      select: {
        id: true,
        userId: true,
        source: true,
        sourceId: true,
        title: true,
        company: true,
        location: true,
        url: true,
        postedAt: true,
        discoveredAt: true,
        importedJobId: true,
        dismissedAt: true,
      },
    }),
    prisma.job.findMany({
      where: {
        userId: user.id,
        source: { not: null },
        sourceId: { not: null },
      },
      select: { source: true, sourceId: true },
    }),
  ]);

  // Build "In Your Jobs" lookup — see component for the two-trigger rule.
  const existingJobKeys = new Set(
    existingJobs.map((j) => `${j.source}:${j.sourceId}`),
  );

  const annotated = leads.map((lead) => ({
    ...lead,
    inMyJobs:
      lead.importedJobId !== null ||
      existingJobKeys.has(`${lead.source}:${lead.sourceId}`),
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-1 flex-col">
      <Header user={user} />

      <main className="flex-1 p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-base font-medium">
              Job Search{" "}
              <span className="text-muted-foreground">({total})</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Daily-scraped openings across Greenhouse, Lever, Ashby,
              RemoteOK, and the Simplify / vansh internship lists.
            </p>
          </div>
        </div>

        <SearchView
          filter={filter}
          leads={annotated}
          total={total}
          page={pageNum}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          q={q}
          sort={sort}
        />
      </main>
    </div>
  );
}
