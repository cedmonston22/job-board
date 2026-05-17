"use client";

import { useActionState, useState, useTransition } from "react";
import {
  ExternalLinkIcon,
  FileIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  deleteResume,
  uploadResume,
  type ResumeUploadResult,
} from "@/app/actions/resume";
import type { Resume } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";

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
    <div className="grid gap-4">
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-4">
        <FileIcon className="size-8 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{resume.fileName}</div>
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

      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Text extraction + AI parsing arrive in steps 2.3–2.4.
      </div>

      <div className="flex justify-between gap-2">
        <DeleteResumeButton />
        <ReplaceResumeButton />
      </div>
    </div>
  );
}

// "Replace" mounts the upload form inline. Same flow as initial upload — the
// server action overwrites the existing row.
function ReplaceResumeButton() {
  const [replacing, setReplacing] = useState(false);

  if (!replacing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setReplacing(true)}
      >
        <UploadIcon className="size-4" />
        Replace
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Replace resume</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setReplacing(false)}
        >
          Cancel
        </Button>
      </div>
      <ResumeUploadForm />
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
