// Background helper that scores a single Job and writes the result back.
// Designed to be called from inside `after()` so the response can return
// immediately while scoring runs against Groq.
//
// Owns the full lifecycle:
//   1. Load the user's resume (return early if no resume / no extracted text)
//   2. Re-load the Job in case it was deleted between create and score
//   3. Call the scorer
//   4. Write fit fields atomically (all five together, or none)
//   5. revalidatePath("/") so the dashboard Fit column updates

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { scoreFit } from "@/lib/fit-scorer";
import { fetchJobDescriptionFromUrl } from "@/lib/fetch-job-description";

// Never throws — any failure logs and exits. This is intentional: the caller
// runs us via `after()` after the response has been sent, so there's nobody
// to surface an error to. Leaving fit fields null is the correct user-facing
// outcome on any failure path.
export async function scoreJobAndStore(
  userId: string,
  jobId: string,
): Promise<void> {
  try {
    // 1. Resume gate. No resume / no extracted text → silently leave the
    //    fields null. Common path for users who haven't been to /profile yet.
    const resume = await prisma.resume.findUnique({
      where: { userId },
      select: { extractedText: true },
    });
    if (!resume?.extractedText) return;

    // 2. Re-fetch the Job. Two reasons:
    //    a) It could have been deleted between the create call and `after()`
    //       firing (unlikely but possible if the user spams delete).
    //    b) Keeps this helper self-contained — callers only pass two ids.
    //    Ownership check happens via `where: { id, userId }`.
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      select: { title: true, company: true, description: true, url: true },
    });
    if (!job) return;

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
    //    with no description will come back `{ ok: false }` and we skip.
    const result = await scoreFit(resume.extractedText, {
      title: job.title,
      company: job.company,
      description,
    });
    if (!result.ok) {
      console.warn(
        `Fit scoring skipped for job ${jobId} (user ${userId}): ${result.error}`,
      );
      return;
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
    //    on the next render. The user may already be on the dashboard
    //    looking at the just-created row — a few seconds later they'll see
    //    the score appear (after Next refreshes the page data).
    revalidatePath("/");
  } catch (err) {
    // Catch-all so a thrown error inside `after()` doesn't crash the
    // serverless invocation. Logs the error for debugging but doesn't
    // surface anything to the user.
    console.error(`scoreJobAndStore failed for job ${jobId}:`, err);
  }
}
