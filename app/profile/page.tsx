import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/avatar";
import { Header } from "@/components/header";
import { ResumeSection } from "@/components/resume/resume-section";

// /profile — the user's account + resume page.
// 2.1 just sets up the routing and a section placeholder. Step 2.2 will
// add the upload UI, 2.3 wires text extraction, 2.4 renders the parsed preview.
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = session.user;

  // Look up the user's resume (one per user). Will be null until they upload
  // their first one.
  const resume = await prisma.resume.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="flex flex-1 flex-col">
      <Header user={user} />

      <main className="flex-1 p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" />
          Back to jobs
        </Link>

        <h1 className="mt-4 text-2xl font-semibold">Profile</h1>

        <div className="mt-6 grid max-w-6xl gap-6">
          <section className="max-w-md rounded-lg border p-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={user.image}
                name={user.name}
                email={user.email ?? ""}
                size="lg"
              />
              <div className="min-w-0">
                <div className="truncate text-lg font-medium">
                  {user.name ?? "Anonymous"}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border p-6">
            <h2 className="text-lg font-medium">Resume</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Upload your resume so the AI features (fit scoring, cover letters)
              can tailor results to your background.
            </p>
            <ResumeSection resume={resume} />
          </section>
        </div>
      </main>
    </div>
  );
}
