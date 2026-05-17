"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreJobAndStore } from "@/lib/score-job";
import { scrapeFilterInputSchema } from "@/lib/zod-schemas";

// Same envelope used by every other mutation in the project — keeps the
// `useActionState` rendering pattern uniform across the codebase.
export type DiscoveredJobActionState = {
  ok: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
  error?: string;
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// ----- saveScrapeFilter -----
// Upsert (one row per user — enforced by `@@unique` on userId). The form
// sidebar binds this via useActionState.
export async function saveScrapeFilter(
  _prev: DiscoveredJobActionState | undefined,
  formData: FormData,
): Promise<DiscoveredJobActionState> {
  const userId = await requireUserId();

  // The MajorCombobox sends an empty string for the "No umbrella" option,
  // which the Zod schema's emptyToUndefined preprocess turns into
  // undefined → optional field skipped → DB column ends up null. No
  // sentinel translation needed.
  const parsed = scrapeFilterInputSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.scrapeFilter.upsert({
    where: { userId },
    create: {
      userId,
      major: parsed.data.major ?? null,
      roles: parsed.data.roles,
    },
    update: {
      major: parsed.data.major ?? null,
      roles: parsed.data.roles,
    },
  });

  // The search page applies the filter at read time, so revalidating it
  // re-runs the filter against the live DiscoveredJob set without us
  // needing to re-scrape.
  revalidatePath("/jobs/search");
  return { ok: true };
}

// ----- importDiscoveredJob -----
// Promotes a lead to a tracked Job (status=SAVED) and stamps the lead's
// importedJobId so the search tab hides it.
//
// Edge cases:
//   - Lead doesn't exist (or isn't this user's): return error.
//   - Already imported: idempotent — return ok with the existing Job id.
//   - A Job with the same (userId, source, sourceId) already exists from a
//     prior import-then-delete-lead flow: reuse it instead of failing the
//     unique constraint.
export async function importDiscoveredJob(
  id: string,
): Promise<DiscoveredJobActionState & { jobId?: string }> {
  const userId = await requireUserId();

  const lead = await prisma.discoveredJob.findFirst({
    where: { id, userId },
  });
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.importedJobId) {
    return { ok: true, jobId: lead.importedJobId };
  }

  // The Job table has @@unique([userId, source, sourceId]) — if the user
  // imported this lead before, then deleted the lead's importedJobId
  // marker somehow (or another DiscoveredJob row references the same
  // upstream id), a fresh create would fail. Detect + reuse.
  const existing = await prisma.job.findFirst({
    where: { userId, source: lead.source, sourceId: lead.sourceId },
    select: { id: true },
  });

  let jobId: string;
  let isFreshJob = false;
  if (existing) {
    jobId = existing.id;
  } else {
    const created = await prisma.job.create({
      data: {
        userId,
        title: lead.title,
        company: lead.company,
        location: lead.location,
        url: lead.url,
        description: lead.description,
        status: "SAVED",
        source: lead.source,
        sourceId: lead.sourceId,
        postedAt: lead.postedAt,
      },
      select: { id: true },
    });
    jobId = created.id;
    isFreshJob = true;
  }

  // updateMany with userId in the where clause — same ownership pattern
  // used everywhere else.
  await prisma.discoveredJob.updateMany({
    where: { id, userId },
    data: { importedJobId: jobId },
  });

  // Both surfaces are stale now: search tab loses this row, dashboard
  // gains a new Job.
  revalidatePath("/jobs/search");
  revalidatePath("/");

  // Auto-score the fresh Job in the background. We don't score reused-
  // existing Jobs — that path only happens when a previous import was
  // un-stamped (rare); the user can hit Re-score manually if they want.
  if (isFreshJob) {
    after(() => scoreJobAndStore(userId, jobId));
  }

  return { ok: true, jobId };
}

// ----- dismissDiscoveredJob -----
// "Not interested." Sets dismissedAt; the search tab hides the row.
export async function dismissDiscoveredJob(
  id: string,
): Promise<DiscoveredJobActionState> {
  const userId = await requireUserId();

  const result = await prisma.discoveredJob.updateMany({
    where: { id, userId },
    data: { dismissedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: "Lead not found" };

  revalidatePath("/jobs/search");
  return { ok: true };
}

// ----- undismissDiscoveredJob -----
// Undo of dismiss. Not surfaced in the table itself (the dismissed row is
// already hidden), but the dismiss action can return a transient inline
// "Undo" affordance that calls this.
export async function undismissDiscoveredJob(
  id: string,
): Promise<DiscoveredJobActionState> {
  const userId = await requireUserId();

  const result = await prisma.discoveredJob.updateMany({
    where: { id, userId },
    data: { dismissedAt: null },
  });
  if (result.count === 0) return { ok: false, error: "Lead not found" };

  revalidatePath("/jobs/search");
  return { ok: true };
}
