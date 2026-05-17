"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Skip-without-uploading. Stamps onboardedAt = now() on the current user so
// `requireOnboarded` stops bouncing them, then redirects to the dashboard.
// Idempotent — calling this again on an already-onboarded user is a no-op
// from the user's perspective (the field is just rewritten with the same
// kind of value).
export async function skipOnboarding(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardedAt: new Date() },
  });

  redirect("/");
}
