import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ResumeSection } from "@/components/resume/resume-section";
import { SkipButton } from "@/components/onboarding/skip-button";

export const metadata: Metadata = {
  title: "Welcome · Job Board",
  description: "Upload your resume to unlock AI fit scoring on every job.",
};

// /onboarding — first-time welcome step. Reached automatically after Google
// sign-in via the redirect baked into requireOnboarded(). On this page we
// run the auth check ourselves (NOT requireOnboarded) — otherwise an
// already-onboarded user landing here by accident would get redirected
// back to /onboarding in an infinite loop.
//
// Two exit paths:
//   1. Upload a resume → uploadResume stamps onboardedAt → next nav lands
//      on / instead of /onboarding.
//   2. Click "Skip for now" → the skipOnboarding server action stamps
//      onboardedAt and redirects to / in one round trip.
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });
  if (row?.onboardedAt) redirect("/");

  // We render `<ResumeSection resume={null} />` so the user gets the upload
  // form directly. The "already uploaded" branch is unreachable here: a
  // user with a Resume row would have had onboardedAt stamped by
  // uploadResume already.
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#fafafa] px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
            <Sparkles className="size-3.5 text-zinc-500" />
            Welcome
            {session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Upload your resume to start.
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Job Board scores every posting against your resume so you only see
            roles that actually fit. You can skip this and add it later from
            your profile.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <ResumeSection resume={null} />
        </section>

        <div className="flex justify-center">
          <SkipButton />
        </div>
      </div>
    </main>
  );
}
