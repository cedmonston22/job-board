"use client";

import { useActionState } from "react";
import {
  saveScrapeFilter,
  type DiscoveredJobActionState,
} from "@/app/actions/discovered-jobs";
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
import { MajorCombobox } from "@/components/search/major-combobox";

// Sort values the dropdown emits. Mapped to TanStack SortingState by the
// parent SearchView. "newest" / "oldest" both sort on postedAt — leads
// without a postedAt sort to the bottom either way.
export type SortBy = "newest" | "oldest";

// Sidebar form on /jobs/search. Saves the user's major + roles to
// ScrapeFilter. The filter applies both at scrape time (lib/scrapers/
// filter.ts in the runner) AND at read time (in the search page server
// component), so changes here take effect immediately on revalidate
// without needing to re-run the scrapers.
export function SearchFilterSidebar({
  filter,
  totalLeads,
  shownLeads,
  sortBy,
  onSortByChange,
}: {
  filter: ScrapeFilter | null;
  totalLeads: number; // unfiltered count of active leads (before filter applied)
  shownLeads: number; // count after filter applied
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
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

        {/* Sort by — inside the form visually but NOT a form field (no
            `name` attribute), so changing it just updates client state
            and doesn't submit. Save Filter only persists Major + Role. */}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-sort">Sort by</Label>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              if (v) onSortByChange(v as SortBy);
            }}
          >
            <SelectTrigger id="filter-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Posted: newest first</SelectItem>
              <SelectItem value="oldest">Posted: oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Major</Label>
          {/* Combobox submits its value via a hidden input named "major"
              — saveScrapeFilter picks it up the same way it picked up the
              old <Select name="major">. Empty string ("") means "no
              umbrella", which the server action turns into null. */}
          <MajorCombobox name="major" initialValue={filter?.major ?? null} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="filter-roles">Role</Label>
          <Textarea
            id="filter-roles"
            name="roles"
            placeholder="data engineer, ml engineer, applied scientist"
            defaultValue={initialRoles}
            rows={3}
            className="text-sm"
          />
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

// "No umbrella" submits as empty string from the hidden input → the Zod
// schema's emptyToUndefined preprocess turns it into undefined → optional
// field skipped → DB column set to null. The old NO_MAJOR sentinel +
// server-side strip dance is no longer needed.