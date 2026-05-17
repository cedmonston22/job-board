import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStaleCutoff } from "@/lib/scrapers/cleanup";
import { applyFilter } from "@/lib/scrapers/filter";
import { Header } from "@/components/header";
import { SearchView } from "@/components/search/search-view";

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

  // Three parallel queries:
  //   1. The user's filter row (one or null)
  //   2. Active leads (not dismissed, within freshness window)
  //   3. ALL of the user's existing Jobs with source+sourceId set — used
  //      to mark leads as "already in your jobs" even when importedJobId
  //      isn't set on the lead (e.g. they imported it from a different
  //      DiscoveredJob row, or the Job pre-dates this lead, etc.)
  const [filter, leads, existingJobs] = await Promise.all([
    prisma.scrapeFilter.findUnique({ where: { userId: user.id } }),
    prisma.discoveredJob.findMany({
      where: {
        userId: user.id,
        // Hide dismissed leads. Imported leads stay visible — the row
        // shows an "In your jobs" badge so you can see what you've
        // already added without losing context.
        dismissedAt: null,
        // 6-month freshness gate.
        OR: [{ postedAt: null }, { postedAt: { gte: cutoff } }],
      },
      // Newest first; the table can re-sort client-side via column headers.
      orderBy: { discoveredAt: "desc" },
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

  // Build a lookup set of "source:sourceId" keys the user already tracks.
  // Used below to mark each lead's inMyJobs flag.
  const existingJobKeys = new Set(
    existingJobs.map((j) => `${j.source}:${j.sourceId}`),
  );

  // Annotate each lead with whether it's already in My Jobs. Two sources
  // of truth here, ORed together:
  //   - importedJobId set on the lead (the user clicked Import on this
  //     specific DiscoveredJob row)
  //   - A Job exists matching this lead's source+sourceId (covers any
  //     other path the job got into My Jobs, e.g. manually imported via
  //     a different lead row that has since been deleted)
  const annotated = leads.map((lead) => ({
    ...lead,
    inMyJobs:
      lead.importedJobId !== null ||
      existingJobKeys.has(`${lead.source}:${lead.sourceId}`),
  }));

  // applyFilter is the SAME function used by the scrape runner — generic
  // over anything with a `title` field. The annotated leads satisfy that.
  const filtered = applyFilter(annotated, filter);

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

        <SearchView
          filter={filter}
          leads={filtered}
          totalLeads={leads.length}
        />
      </main>
    </div>
  );
}
