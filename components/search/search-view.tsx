"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Major } from "@/lib/major-keywords";
import { SearchFilterSidebar } from "@/components/search/search-filter-sidebar";
import {
  SearchTable,
  type LeadWithStatus,
} from "@/components/search/search-table";

// Client wrapper around the sidebar + table. Holds no state of its own —
// it's just the bridge between the page's server-fetched data and the
// URL-driven controls in the children.
//
// All filter/sort/search/pagination state lives in the URL:
//   ?page=N&q=foo&sort=newest&major=Computer+Science
//
// updateParam is a single helper passed down so each control can update
// any param while resetting page to 1 (since changing a filter usually
// invalidates the current page index).
export function SearchView({
  leads,
  total,
  page,
  pageCount,
  pageSize,
  q,
  sort,
  major,
}: {
  leads: LeadWithStatus[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  q: string;
  sort: "newest" | "oldest";
  major: Major | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Build a new URL with one param updated. Empty value clears the
  // param. Reset `page` to 1 unless the change IS the page param itself
  // — otherwise a filter change keeps you on page 17 of an old result
  // set that may have shrunk.
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (key !== "page") next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <SearchFilterSidebar
        totalLeads={total}
        shownLeads={leads.length}
        sortBy={sort}
        onSortByChange={(v) => updateParam("sort", v === "newest" ? null : v)}
        major={major}
        onMajorChange={(v) => updateParam("major", v)}
      />
      <SearchTable
        leads={leads}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={total}
        q={q}
        onQueryChange={(value) => updateParam("q", value || null)}
        onPageChange={(p) => updateParam("page", String(p))}
      />
    </div>
  );
}
