"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { contactInputSchema } from "@/lib/zod-schemas";

// Same action-result shape used by the job actions, kept consistent so the
// client treats every server action uniformly.
export type ContactActionState = {
  ok: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
  error?: string;
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// Verify the job belongs to the current user before letting them attach or
// remove a contact. Prevents a malicious request from adding contacts to
// another user's job by guessing the job id.
async function verifyJobOwnership(jobId: string, userId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  });
  return job !== null;
}

// ----- createContact -----
// The jobId is bound by the caller (similar to how updateJob takes id) so the
// useActionState wiring on the client is clean.
export async function createContact(
  jobId: string,
  _prev: ContactActionState | undefined,
  formData: FormData,
): Promise<ContactActionState> {
  const userId = await requireUserId();
  if (!(await verifyJobOwnership(jobId, userId))) {
    return { ok: false, error: "Job not found" };
  }

  const parsed = contactInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.contact.create({
    data: { ...parsed.data, jobId },
  });

  revalidatePath("/");
  return { ok: true };
}

// ----- deleteContact -----
// Direct-call action. Ownership check goes through the job, since contacts
// don't store userId directly — they belong to a job which belongs to a user.
export async function deleteContact(
  contactId: string,
): Promise<ContactActionState> {
  const userId = await requireUserId();

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, job: { userId } },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Contact not found" };

  await prisma.contact.delete({ where: { id: contactId } });

  revalidatePath("/");
  return { ok: true };
}
