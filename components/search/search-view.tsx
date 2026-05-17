"use client";

import { useState } from "react";
import type { ScrapeFilter } from "@/lib/generated/prisma/client";
import {
  SearchFilterSidebar,
  type SortBy,
} from "@/components/search/search-filter-sidebar";
import {
  SearchTable,
  type LeadWithStatus,
} from "@/components/search/search-table";

// Client wrapper that holds the Sort By state shared between the sidebar
// dropdown and the table. The page server component renders SearchView
// with everything pre-fetched; this wrapper handles the bits that need
// React state (the sort dropdown).
//
// Sort flow:
//   - Sidebar dropdown changes → setSortBy → wrapper re-renders
//   - Table's `key` is tied to sortBy → remounts with fresh internal
//     sorting state on every dropdown change
//   - Column-header clicks update the table's internal state only —
//     they're temporary overrides until the user changes the dropdown
//     or reloads the page
export function SearchView({
  filter,
  leads,
  totalLeads,
}: {
  filter: ScrapeFilter | null;
  leads: LeadWithStatus[];
  totalLeads: number;
}) {
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <SearchFilterSidebar
        filter={filter}
        totalLeads={totalLeads}
        shownLeads={leads.length}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />
      <SearchTable key={sortBy} leads={leads} sortBy={sortBy} />
    </div>
  );
}
