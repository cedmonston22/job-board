"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  ExternalLinkIcon,
  FileIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  deleteResume,
  reparseResume,
  uploadResume,
  type ResumeUploadResult,
} from "@/app/actions/resume";
import type { Resume } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { ResumePreview } from "@/components/resume/resume-preview";

// Server passes the user's existing resume (or null). The two states render
// completely different UI — upload form vs. info card with Replace/Delete.
export function ResumeSection({ resume }: { resume: Resume | null }) {
  if (resume === null) {
    return <ResumeUploadForm />;
  }
  return <ResumeUploaded resume={resume} />;
}

// ============================================================================
// Upload form (shown when the user has no resume yet)
// ============================================================================

function ResumeUploadForm() {
  const [state, formAction, pending] = useActionState<
    ResumeUploadResult | undefined,
    FormData
  >(uploadResume, undefined);

  // Track which file the user has picked so the dropzone reflects the choice
  // visually before they hit Upload.
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  return (
    <form action={formAction} className="grid gap-3">
      <label
        className="grid cursor-pointer place-items-center gap-2 rounded-md border border-dashed p-8 text-center hover:bg-muted/40"
        htmlFor="resume-file"
      >
        <input
          id="resume-file"
          type="file"
          name="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          required
          onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
        />
        {pickedFile ? (
          <>
            <FileIcon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">{pickedFile.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatBytes(pickedFile.size)} · click to change
            </span>
          </>
        ) : (
          <>
            <UploadIcon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              Click to pick a resume file
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, DOCX, or TXT · up to 10 MB
            </span>
          </>
        )}
      </label>

      {state && state.ok === false ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : state && state.ok === true && state.extractionError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <div className="font-medium text-destructive">
            File uploaded, but text extraction failed
          </div>
          <div className="mt-1 break-words text-muted-foreground">
            {state.extractionError}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !pickedFile}>
          {pending ? "Uploading…" : "Upload resume"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Uploaded view (shown when the user already has a resume)
// ============================================================================

function ResumeUploaded({ resume }: { resume: Resume }) {
  return (
    // Two-column grid on lg+ screens — file card + controls on the left,
    // parsed preview / status on the right. Stacks vertically on smaller
    // screens. `content-start` on the left column prevents its items from
    // stretching to match the (usually much taller) preview column.
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="grid content-start gap-4">
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-4">
          <FileIcon className="size-8 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {resume.fileName}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatBytes(resume.fileSize)} ·{" "}
              {formatRelative(resume.uploadedAt)}
            </div>
          </div>
          <a
            href="/api/resume/view"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            View
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>

        <div className="flex justify-between gap-2">
          <DeleteResumeButton />
          <ReplaceResumeButton />
        </div>
      </div>

      <div>
        {!resume.extractedText ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <div className="font-medium text-destructive">
              Couldn't read the file
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              It may be a scanned image (no text layer), password-protected, or
              corrupted. Try replacing with a different format.
            </div>
          </div>
        ) : resume.parsedJson ? (
          <ResumePreview json={resume.parsedJson} />
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <div className="font-medium text-amber-700 dark:text-amber-400">
              AI couldn't parse the resume
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              The text was extracted but Groq's structured-output call failed.
              Try again — the upstream error is usually transient.
            </div>
            <div className="mt-3">
              <ReParseButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// "Replace" is a one-click flow: click button → file picker opens → user
// picks a file → form auto-submits. No intermediate UI.
//
// The trick is a hidden <input type="file"> tied to a real <form>. The visible
// button is `type="button"` so it doesn't submit on its own — its onClick just
// programmatically clicks the hidden input, which opens the OS file picker.
// When the user picks a file, onChange fires; we then call requestSubmit() on
// the form to trigger the bound useActionState formAction with the file.
function ReplaceResumeButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<
    ResumeUploadResult | undefined,
    FormData
  >(uploadResume, undefined);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="inline-flex items-center gap-2"
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="gap-1"
      >
        <UploadIcon className="size-4" />
        {pending ? "Uploading…" : "Replace"}
      </Button>
      {state && state.ok === false ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

// Triggers re-parsing of the existing extractedText. Used when the upload-time
// Groq parse failed (transient API error, etc.). One-click — no confirmation
// since this isn't destructive.
function ReParseButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await reparseResume();
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Parsing…" : "Try parsing again"}
      </Button>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </div>
  );
}

// Two-step destructive action, same pattern as the job delete button.
function DeleteResumeButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon className="size-4" />
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        Delete your resume?
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteResume();
          })
        }
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </Button>
    </div>
  );
}

// ============================================================================
// Formatting helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "5 seconds ago" / "2 days ago" — quick relative time helper.
function formatRelative(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
