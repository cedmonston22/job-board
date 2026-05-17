"use client";

import {
  type ReactNode,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import { PlusIcon, SparklesIcon } from "lucide-react";
import {
  createJob,
  parseJobFromUrl,
  updateJob,
  type JobActionState,
} from "@/app/actions/jobs";
import type { ParsedJob } from "@/lib/zod-schemas";
import type { Job, JobStatus } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ============================================================================
// Types & helpers
// ============================================================================

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

// Shape used to seed form defaults. Covers both autofill (creates a fresh row)
// and edit (loads from an existing row). The two extra optional fields below
// the ParsedJob ones are only populated in edit mode.
type FormPrefill = ParsedJob & {
  url: string;
  status?: JobStatus;
  notes?: string | null;
};

// Convert an existing Job row into the FormPrefill shape so we can seed
// defaultValue on each input in edit mode.
function jobToPrefill(job: Job): FormPrefill {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    // remoteType is `string | null` in the DB but should always be one of the
    // three known values when it's non-null (the Select restricts input).
    remoteType: job.remoteType as ParsedJob["remoteType"],
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    description: job.description,
    url: job.url ?? "",
    status: job.status,
    notes: job.notes,
  };
}

// Build a FormData for the auto-save path (link mode, parse succeeded with
// title + company). Only used in create mode.
function prefillToFormData(prefill: FormPrefill): FormData {
  const fd = new FormData();
  if (prefill.title) fd.set("title", prefill.title);
  if (prefill.company) fd.set("company", prefill.company);
  if (prefill.location) fd.set("location", prefill.location);
  if (prefill.remoteType) fd.set("remoteType", prefill.remoteType);
  if (prefill.salaryMin != null) fd.set("salaryMin", String(prefill.salaryMin));
  if (prefill.salaryMax != null) fd.set("salaryMax", String(prefill.salaryMax));
  if (prefill.description) fd.set("description", prefill.description);
  fd.set("url", prefill.url);
  fd.set("status", "SAVED");
  return fd;
}

// ============================================================================
// JobSheet (controlled, polymorphic)
// ============================================================================

// One sheet component for both create and edit:
//   - No `job` prop  → create mode: link-first autofill + full form fallback
//   - `job` provided → edit mode: full form prefilled with the row's values,
//                      no URL autofill panel (you're editing an existing row,
//                      not adding a fresh one)
//
// Controlled via `open` / `onOpenChange` so the table can drive it externally.
// `trigger` is an optional ReactNode rendered inside <SheetTrigger> — pass it
// for the "+ Add job" header button; omit it when controlling from outside.
export function JobSheet({
  job,
  open,
  onOpenChange,
}: {
  job?: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = job !== undefined;

  // In edit mode we bind the job id into updateJob's first arg, leaving a
  // (prev, formData) signature that matches useActionState's expectations.
  const action = isEdit ? updateJob.bind(null, job.id) : createJob;

  const [state, formAction, pending] = useActionState<
    JobActionState | undefined,
    FormData
  >(action, undefined);

  const [, startTransition] = useTransition();

  // Edit mode always starts in "manual" (full form). Create mode starts in
  // "link" (URL autofill panel only) and may flip to "manual" via the
  // "Add manually instead" link or on a partial autofill result.
  const [mode, setMode] = useState<"link" | "manual">(
    isEdit ? "manual" : "link",
  );

  const [urlInput, setUrlInput] = useState("");
  const [prefill, setPrefill] = useState<FormPrefill | null>(
    isEdit ? jobToPrefill(job) : null,
  );
  const [prefillKey, setPrefillKey] = useState(0);
  const [autofillPending, setAutofillPending] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  // On successful save, close the sheet. In create mode we also reset internal
  // state so the next open starts fresh; in edit mode the parent unmounts us.
  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      if (!isEdit) resetSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function resetSheet() {
    setMode("link");
    setUrlInput("");
    setPrefill(null);
    setAutofillError(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next && !isEdit) resetSheet();
  }

  // ============== create-mode handlers (not used in edit mode) ==============

  async function handleAddFromLink() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setAutofillError(null);
    setAutofillPending(true);
    const result = await parseJobFromUrl(trimmed);
    setAutofillPending(false);

    if (!result.ok) {
      setAutofillError(result.error);
      return;
    }

    const next: FormPrefill = { ...result.data, url: trimmed };

    if (result.data.title && result.data.company) {
      startTransition(() => {
        formAction(prefillToFormData(next));
      });
      return;
    }

    setPrefill(next);
    setPrefillKey((k) => k + 1);
    setMode("manual");
    setAutofillError(
      "Couldn't find the title or company — please fill them in.",
    );
  }

  async function handleAutofillManual() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setAutofillError(null);
    setAutofillPending(true);
    const result = await parseJobFromUrl(trimmed);
    setAutofillPending(false);
    if (result.ok) {
      setPrefill({ ...result.data, url: trimmed });
      setPrefillKey((k) => k + 1);
    } else {
      setAutofillError(result.error);
    }
  }

  const busy = autofillPending || pending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <form
          key={prefillKey}
          action={formAction}
          className="flex h-full flex-col"
        >
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit job" : "Add a job"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Update any field — save when you're done."
                : mode === "link"
                  ? "Paste a job posting link — we'll handle the rest."
                  : "Fill in the details and save."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            {/* URL autofill panel — create mode only. */}
            {!isEdit ? (
              <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-3">
                <Label htmlFor="autofill-url" className="text-xs font-medium">
                  Job posting URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="autofill-url"
                    type="url"
                    placeholder="https://jobs.lever.co/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (mode === "link") void handleAddFromLink();
                        else void handleAutofillManual();
                      }
                    }}
                  />
                  {mode === "link" ? (
                    <Button
                      type="button"
                      onClick={handleAddFromLink}
                      disabled={busy || !urlInput.trim()}
                    >
                      <SparklesIcon />
                      {busy ? "Adding…" : "Add"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAutofillManual}
                      disabled={busy || !urlInput.trim()}
                    >
                      <SparklesIcon />
                      {autofillPending ? "Parsing…" : "Autofill"}
                    </Button>
                  )}
                </div>
                {autofillError ? (
                  <p className="text-xs text-destructive">{autofillError}</p>
                ) : null}
              </div>
            ) : null}

            {/* Link-mode footer: a way out to manual entry. Create mode only. */}
            {!isEdit && mode === "link" ? (
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Add manually instead
              </button>
            ) : null}

            {/* Manual mode (or edit mode): the full form fields. */}
            {mode === "manual" ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Software Engineer"
                    required
                    maxLength={200}
                    defaultValue={prefill?.title ?? ""}
                  />
                  <FieldError errors={state?.fieldErrors?.title} />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="Stripe"
                    required
                    maxLength={100}
                    defaultValue={prefill?.company ?? ""}
                  />
                  <FieldError errors={state?.fieldErrors?.company} />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    name="status"
                    defaultValue={prefill?.status ?? "SAVED"}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAVED">Saved</SelectItem>
                      <SelectItem value="APPLIED">Applied</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={state?.fieldErrors?.status} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="San Francisco"
                      defaultValue={prefill?.location ?? ""}
                    />
                    <FieldError errors={state?.fieldErrors?.location} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="remoteType">Workplace</Label>
                    <Select
                      name="remoteType"
                      defaultValue={prefill?.remoteType ?? ""}
                    >
                      <SelectTrigger id="remoteType" className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="onsite">Onsite</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={state?.fieldErrors?.remoteType} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="salaryMin">Salary min</Label>
                    <Input
                      id="salaryMin"
                      name="salaryMin"
                      type="number"
                      min={0}
                      placeholder="120000"
                      defaultValue={prefill?.salaryMin ?? ""}
                    />
                    <FieldError errors={state?.fieldErrors?.salaryMin} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="salaryMax">Salary max</Label>
                    <Input
                      id="salaryMax"
                      name="salaryMax"
                      type="number"
                      min={0}
                      placeholder="180000"
                      defaultValue={prefill?.salaryMax ?? ""}
                    />
                    <FieldError errors={state?.fieldErrors?.salaryMax} />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="url">Saved URL</Label>
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    placeholder="https://stripe.com/jobs/123"
                    defaultValue={prefill?.url ?? ""}
                  />
                  <FieldError errors={state?.fieldErrors?.url} />
                </div>

                {/* Description is autofill-only — not user-editable in the
                    form. It still gets sent to the server via a hidden input
                    so edits preserve the autofilled text, but Phase 4/5 AI
                    features remain the source of truth for what's in there. */}
                {prefill?.description ? (
                  <input
                    type="hidden"
                    name="description"
                    value={prefill.description}
                  />
                ) : null}

                <div className="grid gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Recruiter Alex reached out on LinkedIn..."
                    rows={3}
                    maxLength={5000}
                    defaultValue={prefill?.notes ?? ""}
                  />
                  <FieldError errors={state?.fieldErrors?.notes} />
                </div>

                {state?.error ? (
                  <p className="text-sm text-destructive">{state.error}</p>
                ) : null}
              </>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            {/* Save button shows whenever the manual form is visible (i.e.,
                always in edit mode, and after switching to manual in create). */}
            {mode === "manual" ? (
              <Button type="submit" disabled={busy}>
                {pending ? "Saving…" : isEdit ? "Save changes" : "Save"}
              </Button>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// AddJobButton — thin wrapper for the "+ Add job" header trigger
// ============================================================================

// Owns its own open state. Renders the trigger button + a JobSheet underneath
// that's in create mode (no `job` prop).
export function AddJobButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Add job
      </Button>
      <JobSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

// Re-export trigger node type for callers that want to use the standalone
// trigger pattern (currently unused but cheap to expose).
export type { ReactNode };
