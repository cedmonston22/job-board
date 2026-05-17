// Helper that scores a single Job and writes the result back. Used in two
// modes:
//   - Background (inside `after()`) — fire-and-forget after create/import.
//     Callers ignore the return value.
//   - Foreground (inside `rescoreJob` server action) — user clicks Re-score
//     and waits. The caller surfaces the reason on failure.
//
// Owns the full lifecycle:
//   1. Load the user's resume (return early if no resume / no extracted text)
//   2. Re-load the Job in case it was deleted between create and score
//   2b. Backfill description from the URL if missing
//   3. Call the scorer
//   4. Write fit fields atomically (all five together, or none)
//   5. revalidatePath("/") so the dashboard Fit column updates

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { scoreFit } from "@/lib/fit-scorer";
import { fetchJobDescriptionFromUrl } from "@/lib/fetch-job-description";

// Discriminated status, mirrors the shape used elsewhere in the codebase.
// Reasons are deliberately granular so the Re-score UI can give the user
// useful feedback instead of a generic "failed".
export type ScoreJobStatus =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_resume" //  user hasn't uploaded a resume (or extraction failed)
        | "job_not_found" // job was deleted between create and score
        | "no_description" // no description in DB AND none fetchable from URL
        | "groq_failed"; // Groq call failed or returned an invalid shape
    };

// Never throws — every failure path returns a status. The background callers
// ignore the result (logging is sufficient there); foreground callers use the
// reason to render a contextual message.
export async function scoreJobAndStore(
  userId: string,
  jobId: string,
): Promise<ScoreJobStatus> {
  try {
    // 1. Resume gate.
    const resume = await prisma.resume.findUnique({
      where: { userId },
      select: { extractedText: true },
    });
    if (!resume?.extractedText) return { ok: false, reason: "no_resume" };

    // 2. Re-fetch the Job. Ownership check happens via `where: { id, userId }`.
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      select: { title: true, company: true, description: true, url: true },
    });
    if (!job) return { ok: false, reason: "job_not_found" };

    // 2b. Backfill description if missing. Happens for Simplify / Ouckah /
    //     vansh leads (those scrapers only return title + url, no JD). We
    //     visit the company's careers page and pull the description out via
    //     JSON-LD or a Groq HTML→description extraction. Persist it so the
    //     user sees it in the JobSheet too — a real bonus side effect.
    let description = job.description;
    if (!description && job.url) {
      const fetched = await fetchJobDescriptionFromUrl(job.url);
      if (fetched) {
        description = fetched;
        await prisma.job.updateMany({
          where: { id: jobId, userId },
          data: { description: fetched },
        });
      }
    }

    // 3. Call the scorer. It enforces minimum JD length internally — a job
    //    with no description will come back `{ ok: false }`.
    if (!description) return { ok: false, reason: "no_description" };
    const result = await scoreFit(resume.extractedText, {
      title: job.title,
      company: job.company,
      description,
    });
    if (!result.ok) {
      console.warn(
        `Fit scoring skipped for job ${jobId} (user ${userId}): ${result.error}`,
      );
      // The scorer can fail two ways: short JD (mapped to no_description so
      // the UI can suggest pasting one in) or Groq failure.
      if (result.error.includes("description")) {
        return { ok: false, reason: "no_description" };
      }
      return { ok: false, reason: "groq_failed" };
    }

    // 4. Atomic write — all five fields together. updateMany lets us scope
    //    by userId for ownership (same pattern as the rest of the actions).
    await prisma.job.updateMany({
      where: { id: jobId, userId },
      data: {
        fitScore: result.data.score,
        fitSummary: result.data.summary,
        fitStrengths: result.data.strengths,
        fitGaps: result.data.gaps,
        fitScoredAt: new Date(),
      },
    });

    // 5. Bust the dashboard cache so the Fit column picks up the new score
    //    on the next render.
    revalidatePath("/");

    return { ok: true };
  } catch (err) {
    // Catch-all so a thrown error inside `after()` doesn't crash the
    // serverless invocation. Mapped to groq_failed since Prisma / network
    // failures are equally opaque to the user.
    console.error(`scoreJobAndStore failed for job ${jobId}:`, err);
    return { ok: false, reason: "groq_failed" };
  }
}
