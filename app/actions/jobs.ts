"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  jobInputSchema,
  jobStatusSchema,
  type JobStatusInput,
} from "@/lib/zod-schemas";

// Shape of the value returned by every form action. Components use
// `useActionState` to render `fieldErrors` next to inputs and `error` at the
// top of the form.
export type JobActionState = {
  ok: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
  error?: string;
};

// Every action below short-circuits with a redirect if the user isn't logged
// in. Returning an id (rather than the whole session) keeps later code tight.
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// ----- createJob -----
// Signature matches what `useActionState` expects: (prevState, formData).
// The first argument is unused — Next passes the previous return value back in
// so you can keep state across submissions if you want to.
export async function createJob(
  _prev: JobActionState | undefined,
  formData: FormData,
): Promise<JobActionState> {
  const userId = await requireUserId();

  const parsed = jobInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.job.create({
    data: {
      ...parsed.data,
      userId,
      // If a job is created already-applied, stamp the time so we can show
      // "applied 3 days ago" in the table later.
      appliedAt: parsed.data.status === "APPLIED" ? new Date() : null,
    },
  });

  // Tell Next.js the cached homepage data is stale so the new job shows up.
  revalidatePath("/");
  return { ok: true };
}

// ----- updateJob -----
// The id comes in as the first argument; in the component we'll `.bind` it
// before passing the action to `useActionState`.
export async function updateJob(
  id: string,
  _prev: JobActionState | undefined,
  formData: FormData,
): Promise<JobActionState> {
  const userId = await requireUserId();

  const parsed = jobInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Look up the row's current state so we can detect a status transition.
  const existing = await prisma.job.findFirst({
    where: { id, userId },
    select: { status: true, appliedAt: true },
  });
  if (!existing) return { ok: false, error: "Job not found" };

  const justAppliedNow =
    parsed.data.status === "APPLIED" && existing.status !== "APPLIED";

  // updateMany takes a non-unique `where`, which lets us combine id + userId
  // as the filter. This prevents a malicious request from updating another
  // user's row by guessing an id.
  const result = await prisma.job.updateMany({
    where: { id, userId },
    data: {
      ...parsed.data,
      // Only set appliedAt on the transition INTO applied. If they edit an
      // already-applied job, keep the original applied date.
      ...(justAppliedNow && { appliedAt: new Date() }),
    },
  });

  if (result.count === 0) return { ok: false, error: "Job not found" };

  revalidatePath("/");
  return { ok: true };
}

// ----- updateJobStatus -----
// Direct-call action (no FormData) — used by the inline status dropdown in the
// table. The client component invokes this as `await updateJobStatus(id, val)`.
export async function updateJobStatus(
  id: string,
  status: JobStatusInput,
): Promise<JobActionState> {
  const userId = await requireUserId();

  const parsed = jobStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const existing = await prisma.job.findFirst({
    where: { id, userId },
    select: { status: true, appliedAt: true },
  });
  if (!existing) return { ok: false, error: "Job not found" };

  const justAppliedNow =
    parsed.data === "APPLIED" && existing.status !== "APPLIED";

  await prisma.job.updateMany({
    where: { id, userId },
    data: {
      status: parsed.data,
      ...(justAppliedNow && { appliedAt: new Date() }),
    },
  });

  revalidatePath("/");
  return { ok: true };
}

// ----- deleteJob -----
export async function deleteJob(id: string): Promise<JobActionState> {
  const userId = await requireUserId();

  const result = await prisma.job.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) return { ok: false, error: "Job not found" };

  revalidatePath("/");
  return { ok: true };
}
