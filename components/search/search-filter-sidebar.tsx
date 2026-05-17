"use client";

import { useActionState } from "react";
import {
  saveScrapeFilter,
  type DiscoveredJobActionState,
} from "@/app/actions/discovered-jobs";
import { MAJOR_OPTIONS } from "@/lib/major-keywords";
import type { ScrapeFilter } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Sentinel value for the "no umbrella" option in the dropdown. Base UI's
// Select treats empty string as "no value" and renders the placeholder,
// which would visually conflict — we use a real string and translate to
// null in the submitted form data.
const NO_MAJOR = "__none__";

// Sidebar form on /jobs/search. Saves the user's major + roles to
// ScrapeFilter. The filter applies both at scrape time (lib/scrapers/
// filter.ts in the runner) AND at read time (in the search page server
// component), so changes here take effect immediately on revalidate
// without needing to re-run the scrapers.
export function SearchFilterSidebar({
  filter,
  totalLeads,
  shownLeads,
}: {
  filter: ScrapeFilter | null;
  totalLeads: number; // unfiltered count of active leads (before filter applied)
  shownLeads: number; // count after filter applied
}) {
  const [state, formAction, pending] = useActionState<
    DiscoveredJobActionState | undefined,
    FormData
  >(saveScrapeFilter, undefined);

  // Comma- or newline-joined for the textarea. Server-side preprocess
  // splits the user's input back into an array.
  const initialRoles = (filter?.roles ?? []).join(", ");

  return (
    <aside className="w-full shrink-0 md:w-64">
      <form
        action={formAction}
        className="grid gap-4 rounded-lg border p-4"
      >
        <h3 className="text-sm font-semibold">Filter</h3>

        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{shownLeads}</span>{" "}
          of {totalLeads} active lead{totalLeads === 1 ? "" : "s"}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="filter-major">Major</Label>
          <Select
            name="major"
            defaultValue={filter?.major ?? NO_MAJOR}
          >
            <SelectTrigger id="filter-major" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MAJOR}>No umbrella</SelectItem>
              {MAJOR_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Title must include one of the major&apos;s keywords (e.g. Computer
            Science → engineer / developer / SWE / …).
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="filter-roles">Specific roles (optional)</Label>
          <Textarea
            id="filter-roles"
            name="roles"
            placeholder="data engineer, ml engineer, applied scientist"
            defaultValue={initialRoles}
            rows={3}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Comma- or newline-separated. When set, this OVERRIDES the major
            umbrella — title must match one of these.
          </p>
        </div>

        {state?.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save filter"}
        </Button>

        {state?.ok ? (
          <p className="text-xs text-muted-foreground">Filter saved.</p>
        ) : null}
      </form>
    </aside>
  );
}

// NO_MAJOR is a UI-only sentinel — the server action strips it before
// the Zod schema sees the form data so it parses cleanly as "no major
// selected." See saveScrapeFilter in app/actions/discovered-jobs.ts.