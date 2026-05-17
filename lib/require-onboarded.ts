import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Refined session type: after the auth + onboarding checks below pass,
// `session.user.id` is guaranteed defined. Returning this richer type
// instead of the raw `Session | null` lets callers skip their own null
// narrowing.
export type OnboardedSession = Session & {
  user: NonNullable<Session["user"]> & { id: string };
};

// Drop-in replacement for the `await auth(); if (!session) redirect("/login")`
// dance used by every authed page. Adds a second gate: if the user hasn't
// completed onboarding yet (onboardedAt is null), bounce them to
// `/onboarding` first.
export async function requireOnboarded(): Promise<OnboardedSession> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });
  if (!row?.onboardedAt) redirect("/onboarding");

  return session as OnboardedSession;
}
