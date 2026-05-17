import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { AddJobSheet } from "@/components/jobs/add-job-sheet";
import { JobsTable } from "@/components/jobs/jobs-table";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function Home() {
  // Auth gate: every code path below assumes a logged-in user.
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Server-side fetch of this user's jobs. Server components can await Prisma
  // queries directly — no API endpoint, no fetch, no useEffect.
  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Job Board</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{session.user.email}</span>
          <form action={handleSignOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium">
            Your jobs{" "}
            <span className="text-muted-foreground">({jobs.length})</span>
          </h2>
          <AddJobSheet />
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
