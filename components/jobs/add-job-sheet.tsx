"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { PlusIcon, SparklesIcon } from "lucide-react";
import {
  createJob,
  parseJobFromUrl,
  type JobActionState,
} from "@/app/actions/jobs";
import type { ParsedJob } from "@/lib/zod-schemas";
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
  SheetTrigger,
} from "@/components/ui/sheet";

// Small helper: render the per-field validation messages we get back from the
// server action's Zod validation. Empty arrays render nothing.
function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

// Shape we use to prefill the form after a successful URL autofill. Extends
// ParsedJob (from Groq/JSON-LD) with the URL the user typed — the parser
// doesn't return that since we already know it client-side.
type FormPrefill = ParsedJob & { url: string };

// Build the FormData that createJob expects from a parsed prefill. Used for the
// auto-save path in link mode — we skip the form's DOM serialization entirely
// and submit programmatically.
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

export function AddJobSheet() {
  // Sheet open/closed. Controlled so we can close it after a successful save.
  const [open, setOpen] = useState(false);

  // "link" mode shows just the URL panel + Add button (the default — minimal UI).
  // "manual" mode reveals the full form for typing or fixing autofill misses.
  const [mode, setMode] = useState<"link" | "manual">("link");

  // Autofill state. urlInput is what the user has typed; prefill holds the
  // parsed result; prefillKey bumps to force a form remount so defaultValues
  // pick up new prefill data; autofillPending/autofillError track the
  // parseJobFromUrl call.
  const [urlInput, setUrlInput] = useState("");
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);
  const [autofillPending, setAutofillPending] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  // useActionState wires the createJob server action to React's render cycle.
  // We call formAction(formData) directly for the auto-save path; in manual
  // mode the <form action={formAction}> wiring handles it.
  const [state, formAction, pending] = useActionState<
    JobActionState | undefined,
    FormData
  >(createJob, undefined);

  // useActionState's formAction wants to run inside a transition. When wired
  // via <form action={formAction}> React handles that automatically. For our
  // auto-save path we call formAction directly, so we provide the transition
  // ourselves via startTransition.
  const [, startTransition] = useTransition();

  // On successful save, close + reset.
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      resetSheet();
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
    setOpen(next);
    if (!next) resetSheet();
  }

  // Link-mode "Add" handler. Parses the URL, then:
  //   - If we got title + company → auto-save (one-click flow).
  //   - If we got partial data → switch to manual mode with prefilled values.
  //   - If the parse errored → show the error inline + offer manual entry.
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
      // Have everything required — auto-save without showing the full form.
      // Wrapped in startTransition so `pending` from useActionState flips
      // correctly (React would otherwise warn).
      startTransition(() => {
        formAction(prefillToFormData(next));
      });
      return;
    }

    // Partial result — drop into manual mode with whatever we got.
    setPrefill(next);
    setPrefillKey((k) => k + 1);
    setMode("manual");
    setAutofillError(
      "Couldn't find the title or company — please fill them in.",
    );
  }

  // Manual-mode "Autofill" button. Same parse, but never auto-saves — the user
  // is already in the form view and can review/edit.
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
      <SheetTrigger
        render={
          <Button>
            <PlusIcon />
            Add job
          </Button>
        }
      />
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <form
          key={prefillKey}
          action={formAction}
          className="flex h-full flex-col"
        >
          <SheetHeader>
            <SheetTitle>Add a job</SheetTitle>
            <SheetDescription>
              {mode === "link"
                ? "Paste a job posting link — we'll handle the rest."
                : "Fill in the details and save."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            {/* URL panel — visible in both modes. In link mode, hitting Enter
                or clicking Add does the parse+save. In manual mode it just
                prefills the existing form fields. */}
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
                    // Pressing Enter in the URL field shouldn't submit the
                    // (potentially empty) form — it should trigger our parse.
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

            {/* Link-mode footer: a way out to manual entry. */}
            {mode === "link" ? (
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Add manually instead
              </button>
            ) : null}

            {/* Manual mode: the full form fields. */}
            {mode === "manual" ? (
              <>
                {/* Title */}
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

                {/* Company */}
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

                {/* Status */}
                <div className="grid gap-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="SAVED">
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

                {/* Location + Remote type */}
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

                {/* Salary range */}
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

                {/* Saved URL (separate from the autofill input above). */}
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

                {/* Description — autofilled by the parser. */}
                <div className="grid gap-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="What the role involves..."
                    rows={4}
                    maxLength={20000}
                    defaultValue={prefill?.description ?? ""}
                  />
                  <FieldError errors={state?.fieldErrors?.description} />
                </div>

                {/* Notes — your private notes, never autofilled. */}
                <div className="grid gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Recruiter Alex reached out on LinkedIn..."
                    rows={3}
                    maxLength={5000}
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
            {mode === "manual" ? (
              <Button type="submit" disabled={busy}>
                {pending ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
