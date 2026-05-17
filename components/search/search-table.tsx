"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dismissDiscoveredJob,
  importDiscoveredJob,
} from "@/app/actions/discovered-jobs";
import { SOURCE_TYPE_LABELS } from "@/lib/scrapers/source-labels";
import type { DiscoveredJob } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// The page server component selects fields explicitly (no `description`),
// so the row type drops it via Omit. Plus the server-computed inMyJobs
// flag. If the page ever adds description back to the select, update this.
export type LeadWithStatus = Omit<DiscoveredJob, "description"> & {
  inMyJobs: boolean;
};

// ============================================================================
// Cell helpers
// ============================================================================

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ============================================================================
// Location cell — natural CSS wrap, clamped at 5 lines, expandable
// ============================================================================

const LOC_MAX_WIDTH = "max-w-[180px]";

function LocationCell({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    setIsClamped(ref.current.scrollHeight > ref.current.clientHeight);
  }, [value, expanded]);

  if (!value) return <Dash />;

  return (
    <div className={cn(LOC_MAX_WIDTH, "text-sm")}>
      <div
        ref={ref}
        className={cn(
          "break-words leading-snug",
          !expanded && "line-clamp-5",
        )}
      >
        {value}
      </div>
      {isClamped || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUpIcon className="size-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-3" />
              Show all
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

// ============================================================================
// Row action buttons (Add to My Jobs / In Your Jobs + Dismiss)
// ============================================================================

function RowActions({ lead }: { lead: LeadWithStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isImported = lead.inMyJobs;

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const res = await importDiscoveredJob(lead.id);
      if (!res.ok) setError(res.error ?? "Import failed");
    });
  }

  function handleDismiss() {
    setError(null);
    startTransition(async () => {
      const res = await dismissDiscoveredJob(lead.id);
      if (!res.ok) setError(res.error ?? "Dismiss failed");
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {isImported ? (
        <span
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          title="This role is already in My Jobs"
        >
          <CheckIcon className="size-3.5" />
          In Your Jobs
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Add to My Jobs"
          onClick={handleImport}
          disabled={pending}
          className="gap-1"
        >
          <PlusIcon className="size-4" />
          Add to My Jobs
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Not interested"
        onClick={handleDismiss}
        disabled={pending}
      >
        <XIcon className="size-4" />
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

// ============================================================================
// Column definitions
// ============================================================================

// Server-side sort means clicking column headers wouldn't change anything
// across the full dataset — only the visible 50. To avoid a misleading
// affordance, all columns have enableSorting: false. Sort is sidebar-only.
const columns: ColumnDef<LeadWithStatus>[] = [
  {
    accessorKey: "company",
    header: "Company",
    size: 130,
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Role",
    enableSorting: false,
    // Title is the click-target for the posting — underlined so users know
    // it navigates, opens in a new tab so they don't lose the search page.
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <a
          href={lead.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-start gap-1 text-primary underline underline-offset-2 hover:no-underline"
        >
          <span>{lead.title}</span>
          <ExternalLinkIcon className="mt-0.5 size-3 shrink-0" />
        </a>
      );
    },
  },
  {
    accessorKey: "location",
    header: "Location",
    size: 200,
    enableSorting: false,
    cell: ({ getValue }) => <LocationCell value={getValue<string | null>()} />,
  },
  {
    accessorKey: "source",
    header: "Source",
    size: 130,
    enableSorting: false,
    cell: ({ getValue }) => {
      const v = getValue<keyof typeof SOURCE_TYPE_LABELS>();
      return (
        <span className="text-xs text-muted-foreground">
          {SOURCE_TYPE_LABELS[v]}
        </span>
      );
    },
  },
  {
    accessorKey: "postedAt",
    header: "Posted",
    size: 90,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(row.original.postedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <RowActions lead={row.original} />,
  },
];

const WRAPPING_COLUMNS = new Set(["company", "title", "location"]);

// ============================================================================
// Search bar — URL-driven via debounced onQueryChange
// ============================================================================

const SEARCH_DEBOUNCE_MS = 400;

// Local state lets typing feel instant even though the URL update (and
// resulting server re-fetch) is debounced. We initialize from
// `initialValue` but DON'T re-sync if the prop changes later — adding a
// useEffect to sync would trip the setState-in-effect lint, and keying
// the component on the prop would remount mid-typing and steal focus.
// Trade-off: browser back/forward may leave the input slightly stale.
// User can clear the box to reset; acceptable for an uncommon case.
function SearchBar({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  // Track the latest committed value to avoid pushing redundant URL
  // updates on every keystroke after debounce fires.
  const lastCommittedRef = useRef(initialValue);

  useEffect(() => {
    const t = setTimeout(() => {
      if (value !== lastCommittedRef.current) {
        lastCommittedRef.current = value;
        onChange(value);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, onChange]);

  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search company, role, location…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// ============================================================================
// Main table
// ============================================================================

export function SearchTable({
  leads,
  page,
  pageCount,
  pageSize,
  total,
  q,
  onQueryChange,
  onPageChange,
}: {
  leads: LeadWithStatus[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  q: string;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
}) {
  // TanStack table without filter/sort/pagination row models — those all
  // happen on the server now. The table is purely a renderer for the
  // page of rows we received.
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  // "1–50 of 3,217" style label. Empty when there are no rows.
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(start + leads.length - 1, total);
  const pageLabel = total === 0 ? "0 of 0" : `${start}–${end} of ${total}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <SearchBar initialValue={q} onChange={onQueryChange} />

      <div className="rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const size = header.column.columnDef.size;
                  return (
                    <TableHead
                      key={header.id}
                      style={size ? { width: `${size}px` } : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {total === 0 && q === ""
                    ? "No leads yet. Run a scrape from devtools (POST /api/scrape/run) to populate this list."
                    : "No leads match your search."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const wraps = WRAPPING_COLUMNS.has(cell.column.id);
                    return (
                      <TableCell
                        key={cell.id}
                        className={
                          wraps ? "whitespace-normal align-top" : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — hidden when there's only one page of results. */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{pageLabel}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="gap-1"
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount}
              className="gap-1"
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
