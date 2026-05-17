"use server";

import { del, put } from "@vercel/blob";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
// Prisma uses a special sentinel (Prisma.DbNull) to set a Json? column to SQL
// NULL, distinguishing it from the JSON value `null`. Plain `null` in an update
// is a type error for Json fields — must use this.
import { Prisma } from "@/lib/generated/prisma/client";
import { extractResumeText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";

// What the client passes as `result` from useActionState.
export type ResumeUploadResult =
  | { ok: true; extractionError?: string; parseError?: string }
  | { ok: false; error: string };

// MIME types we accept. Browsers send the same type from PDF/DOCX/TXT files
// regardless of OS, so we can validate strictly. Extensions also checked
// because some browsers occasionally send `application/octet-stream`.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

// 10 MB cap. Resumes are typically 50–500 KB; 10 MB is a generous ceiling that
// also avoids hitting Vercel's serverless function body-size limit.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// ----- uploadResume -----
// Accepts a single file from a <form>, validates it, uploads to Vercel Blob,
// and upserts the Resume row. Replaces any existing resume for the user.
export async function uploadResume(
  _prev: ResumeUploadResult | undefined,
  formData: FormData,
): Promise<ResumeUploadResult> {
  const userId = await requireUserId();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please pick a file to upload." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "File is too large. Max 10 MB." };
  }

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const typeOk =
    ALLOWED_MIME_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(ext);
  if (!typeOk) {
    return { ok: false, error: "Unsupported file. Use PDF, DOCX, or TXT." };
  }

  // Look up the existing resume so we can delete its blob after successful
  // upload. We delete AFTER the upsert succeeds — if the upload itself fails,
  // the user's existing resume stays intact.
  const existing = await prisma.resume.findUnique({
    where: { userId },
    select: { fileUrl: true },
  });

  // Read the file bytes once. We need them twice: for the Blob upload AND for
  // text extraction. arrayBuffer() consumes a File once, so we save it to a
  // Buffer to reuse.
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to Vercel Blob with `access: "private"`. The returned URL is an
  // internal identifier — NOT publicly accessible. To let the browser view the
  // file, we'll proxy it through `/api/resume/view` which auth-checks on each
  // request and uses the SDK to fetch the bytes server-side.
  // `addRandomSuffix` ensures unique URLs so re-uploads get new paths.
  let blob;
  try {
    blob = await put(file.name, buffer, {
      access: "private",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: true,
    });
  } catch (err) {
    console.error("Blob upload failed:", err);
    return {
      ok: false,
      error:
        "Upload failed. Check that BLOB_READ_WRITE_TOKEN is set in .env.",
    };
  }

  // Extract plain text from the file so Phase 4/5 AI features have something
  // to read. On failure we still save the resume — the user can re-upload a
  // different format. extractedText is nullable on the model.
  const extraction = await extractResumeText(
    buffer,
    file.type || "application/octet-stream",
  );
  const extractedText = extraction.ok ? extraction.text : null;

  // If we have text, immediately ask Groq to parse it into structured JSON.
  // We do this inline (rather than firing a separate "parse" call after the
  // upload) so the user sees one loading state and the result is ready when
  // the page revalidates.
  let parsedJson: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  let parsedAt: Date | null = null;
  let parseError: string | undefined;
  if (extractedText) {
    const parsed = await parseResumeText(extractedText);
    if (parsed.ok) {
      parsedJson = parsed.data as Prisma.InputJsonValue;
      parsedAt = new Date();
    } else {
      parseError = parsed.error;
    }
  }

  // Upsert the DB row. Clearing parsedJson/parsedAt — the new file means any
  // previously-parsed data is stale; step 2.4 will fill these in.
  await prisma.resume.upsert({
    where: { userId },
    create: {
      userId,
      fileUrl: blob.url,
      fileName: file.name,
      fileMimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      extractedText,
      parsedJson,
      parsedAt,
    },
    update: {
      fileUrl: blob.url,
      fileName: file.name,
      fileMimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      extractedText,
      parsedJson,
      parsedAt,
    },
  });

  // Best-effort cleanup of the old blob. If it fails (network blip, blob
  // already gone), we log and move on — an orphan blob is acceptable.
  if (existing && existing.fileUrl !== blob.url) {
    try {
      await del(existing.fileUrl);
    } catch (err) {
      console.error("Failed to delete previous resume blob:", err);
    }
  }

  revalidatePath("/profile");
  return {
    ok: true,
    extractionError: extraction.ok ? undefined : extraction.error,
    parseError,
  };
}

// ----- reparseResume -----
// Re-runs Groq parsing against the already-stored extractedText. Used when
// the first parse failed, or when the user wants a fresh attempt. Doesn't
// touch the blob — only updates parsedJson + parsedAt.
export async function reparseResume(): Promise<ResumeUploadResult> {
  const userId = await requireUserId();

  const resume = await prisma.resume.findUnique({
    where: { userId },
    select: { extractedText: true },
  });
  if (!resume) return { ok: false, error: "No resume to parse." };
  if (!resume.extractedText) {
    return { ok: false, error: "No extracted text — re-upload the file." };
  }

  const parsed = await parseResumeText(resume.extractedText);

  await prisma.resume.update({
    where: { userId },
    data: {
      parsedJson: parsed.ok
        ? (parsed.data as Prisma.InputJsonValue)
        : Prisma.DbNull,
      parsedAt: parsed.ok ? new Date() : null,
    },
  });

  revalidatePath("/profile");
  return parsed.ok ? { ok: true } : { ok: false, error: parsed.error };
}

// ----- deleteResume -----
// Removes both the blob and the DB row.
export async function deleteResume(): Promise<ResumeUploadResult> {
  const userId = await requireUserId();

  const existing = await prisma.resume.findUnique({
    where: { userId },
    select: { fileUrl: true },
  });
  if (!existing) return { ok: false, error: "No resume to delete." };

  // Delete the blob first. If this fails, we still remove the DB row so the
  // user doesn't see a broken state — better to have an orphan blob than to
  // block the user from clearing their resume.
  try {
    await del(existing.fileUrl);
  } catch (err) {
    console.error("Failed to delete resume blob:", err);
  }

  await prisma.resume.delete({ where: { userId } });

  revalidatePath("/profile");
  return { ok: true };
}
