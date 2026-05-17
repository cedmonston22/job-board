"use client";

import type { Major } from "@/lib/major-keywords";
import { Label } from "@/components/ui/label";
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

// Sidebar for /jobs/search. No save button — every control writes
// straight to the URL (`?sort=`, `?major=`) via callbacks from
// SearchView, the same UX as the My Jobs filter sidebar.
export function SearchFilterSidebar({
  totalLeads,
  shownLeads,
  sortBy,
  onSortByChange,
  major,
  onMajorChange,
}: {
  totalLeads: number; // unfiltered count of active leads (before filter applied)
  shownLeads: number; // count after filter applied
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
  major: Major | null;
  onMajorChange: (value: string | null) => void;
}) {
  return (
    <aside className="w-full shrink-0 md:w-64">
      <div className="grid gap-4 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Filter</h3>

        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{shownLeads}</span>{" "}
          of {totalLeads} active lead{totalLeads === 1 ? "" : "s"}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="filter-sort">Sort by</Label>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              if (v) onSortByChange(v as SortBy);
            }}
          >
            <SelectTrigger id="filter-sort" className="w-full">
              <SelectValue>
                {(v) => (v === "oldest" ? "Oldest" : "Newest")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Major</Label>
          {/* Combobox auto-applies on change via onMajorChange → URL
              update → page server component re-runs with the new filter.
              No DB write, no save button. */}
          <MajorCombobox
            major={major}
            onChange={(value) => onMajorChange(value)}
          />
        </div>
      </div>
    </aside>
  );
}
