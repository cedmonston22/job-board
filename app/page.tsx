import { prisma } from "@/lib/prisma";
import { requireOnboarded } from "@/lib/require-onboarded";
import { Header } from "@/components/header";
import { AddJobButton } from "@/components/jobs/job-sheet";
import { JobsTable } from "@/components/jobs/jobs-table";

export default async function Home() {
  // Auth + onboarding gate. Redirects to /login if signed out, or to
  // /onboarding if signed in but hasn't been through the welcome step.
  const session = await requireOnboarded();

  // Server-side fetch of this user's jobs. Server components can await Prisma
  // queries directly — no API endpoint, no fetch, no useEffect.
  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { contacts: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="flex flex-1 flex-col">
      <Header user={session.user} />

      <main className="flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium">
            Your jobs{" "}
            <span className="text-muted-foreground">({jobs.length})</span>
          </h2>
          <AddJobButton />
        </div>

        {jobs.length === 0 ? <EmptyState /> : <JobsTable jobs={jobs} />}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed py-16 text-center">
      <p className="text-sm text-muted-foreground">
        No jobs yet. Click{" "}
        <span className="font-medium text-foreground">Add job</span> to start
        tracking.
      </p>
    </div>
  );
}
