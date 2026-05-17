import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStaleCutoff } from "@/lib/scrapers/cleanup";
import { applyFilter } from "@/lib/scrapers/filter";
import { Header } from "@/components/header";
import { SearchFilterSidebar } from "@/components/search/search-filter-sidebar";
import { SearchTable } from "@/components/search/search-table";

// /jobs/search — the scraped-leads tab.
// Server component: auth-gates, fetches the user's ScrapeFilter + active
// DiscoveredJob rows, applies the filter at read time, hands the slimmed
// list to the client table.
//
// Why filter at READ time even though the runner already filters at
// scrape time? Because the user can change their filter on this page,
// and we don't want every save to trigger a multi-minute re-scrape. The
// scrape-time filter keeps the DB small; the read-time filter is the
// fast knob the user actually controls.
export default async function JobSearchPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = session.user;

  // Freshness window: never show a job posted >6 months ago. Same threshold
  // used by deleteStaleDiscoveredJobs at scrape time — applying it here
  // too means the user never sees stale rows even if the cleanup hasn't
  // run yet (e.g. they haven't re-triggered a scrape today). For jobs
  // where postedAt is null (Simplify/vansh markdown rows sometimes lack a
  // parseable date), we trust the existing scrape-time cleanup, which
  // uses discoveredAt as a fallback.
  const cutoff = getStaleCutoff();

  // Parallel queries — one round-trip for both.
  const [filter, leads] = await Promise.all([
    prisma.scrapeFilter.findUnique({ where: { userId: user.id } }),
    prisma.discoveredJob.findMany({
      where: {
        userId: user.id,
        // Hide already-imported leads (they live in /My Jobs now).
        importedJobId: null,
        // Hide dismissed leads.
        dismissedAt: null,
        // 6-month freshness gate.
        OR: [{ postedAt: null }, { postedAt: { gte: cutoff } }],
      },
      // Newest first; the table can re-sort client-side via column headers.
      orderBy: { discoveredAt: "desc" },
    }),
  ]);

  // applyFilter is the SAME function used by the scrape runner — generic
  // over anything with a `title` field. DiscoveredJob satisfies that.
  const filtered = applyFilter(leads, filter);

  return (
    <div className="flex flex-1 flex-col">
      <Header user={user} />

      <main className="flex-1 p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-base font-medium">
              Job Search{" "}
              <span className="text-muted-foreground">({filtered.length})</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Daily-scraped openings across {/* informal source count */}
              Greenhouse, Lever, Ashby, RemoteOK, and the Simplify / vansh
              internship lists.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <SearchFilterSidebar
            filter={filter}
            totalLeads={leads.length}
            shownLeads={filtered.length}
          />
          <SearchTable leads={filtered} />
        </div>
      </main>
    </div>
  );
}
