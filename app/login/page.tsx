import type { Metadata } from "next";
import { LandingBackground } from "@/components/landing/landing-background";
import { SignInCard } from "@/components/landing/sign-in-card";

export const metadata: Metadata = {
  title: "Sign in · Job Board",
  description:
    "Your personal job-hunt dashboard. Track applications, score fit against your resume, and surface postings from LinkedIn, Ashby, Greenhouse, Indeed, ZipRecruiter, Glassdoor, and Simplify.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#fafafa] px-4 py-12">
      <LandingBackground />
      <SignInCard className="relative z-10" />
    </main>
  );
}
