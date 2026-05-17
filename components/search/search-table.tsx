"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
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

// Pagination size. 50 keeps the DOM cheap even with 5k+ leads in the
// underlying dataset.
const PAGE_SIZE = 50;

// ============================================================================
// Cell helpers
// ============================================================================

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

// "3 days ago" / "2 weeks ago" — short relative format for the table.
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
// Location cell — natural CSS wrap, clamped at LOC_MAX_LINES, expandable
// ============================================================================

// Cap the visible height before the expand arrow shows up. We use the
// Tailwind class `line-clamp-5` (literal, can't interpolate — Tailwind
// generates classes at build time). If you change 5 here, update the
// className below too.
//
// Fixed width for the column so the text has something to wrap against.
// 180px ≈ 22ch of regular text — wide enough for "San Francisco, CA"
// without breaking, narrow enough to keep the table tight.
const LOC_MAX_WIDTH = "max-w-[180px]";

function LocationCell({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  // Whether the text actually overflows the clamp. We can't know this from
  // string length alone (column width, font metrics, wrap points all
  // matter) — measure after render via a ref.
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // scrollHeight > clientHeight when -webkit-line-clamp is hiding rows.
    // When expanded, the clamp class is removed, scrollHeight == clientHeight,
    // and this would flip back to false — but we still want the toggle
    // button visible. We OR with `expanded` in the JSX to keep it shown.
    setIsClamped(ref.current.scrollHeight > ref.current.clientHeight);
  }, [value, expanded]);

  if (!value) return <Dash />;

  return (
    <div className={cn(LOC_MAX_WIDTH, "text-sm")}>
      <div
        ref={ref}
        className={cn(
          "break-words leading-snug",
          // line-clamp-N uses -webkit-line-clamp: shows N lines max, ellipsis
          // on the last. Tailwind v4 ships line-clamp-1..6 + line-clamp-none.
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
// Row action buttons (Import + Dismiss)
// ============================================================================

function RowActions({ lead }: { lead: DiscoveredJob }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Import to My Jobs"
        onClick={handleImport}
        disabled={pending}
        className="gap-1"
      >
        <PlusIcon className="size-4" />
        Import
      </Button>
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

// Column widths in pixels. Table is set to `table-fixed` (see render below),
// so these are enforced rather than advisory. Role gets no `size` — under
// table-fixed, the unspecified column absorbs all remaining width, which
// means long role titles get the most room.
//
// Sum of fixed widths: 130 + 200 + 130 + 90 + 130 = 680px. The Role column
// gets whatever's left in the main area (typically ~250-400px on a laptop).
const columns: ColumnDef<DiscoveredJob>[] = [
  {
    accessorKey: "company",
    header: "Company",
    size: 130,
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Role",
    // No size → flex column under table-fixed.
    cell: ({ row }) => {
      const lead = row.original;
      // Title links out to the apply URL in a new tab. Most leads' value to
      // the user is reading the actual posting, so click-target = link
      // is the right default.
      return (
        <a
          href={lead.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-start gap-1 hover:underline"
        >
          <span>{lead.title}</span>
          <ExternalLinkIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
        </a>
      );
    },
  },
  {
    accessorKey: "location",
    header: "Location",
    size: 200,
    cell: ({ getValue }) => <LocationCell value={getValue<string | null>()} />,
  },
  {
    accessorKey: "source",
    header: "Source",
    size: 130,
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
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(row.original.postedAt)}
      </span>
    ),
    // Sort newest-first when active.
    sortingFn: (a, b) => {
      const av = a.original.postedAt?.getTime() ?? 0;
      const bv = b.original.postedAt?.getTime() ?? 0;
      return av - bv;
    },
  },
  // (Discovered column intentionally dropped — Posted carries the relevant
  // recency info, and dropping a column gives the rest more breathing room.)
  {
    id: "actions",
    header: "",
    size: 130,
    enableSorting: false,
    cell: ({ row }) => <RowActions lead={row.original} />,
  },
];

// Cells that need to wrap rather than truncate. The default `TableCell`
// from components/ui/table.tsx has `whitespace-nowrap` baked in; this set
// tells the render loop to override that for the long-content columns.
const WRAPPING_COLUMNS = new Set(["title", "location"]);

// ============================================================================
// Search bar
// ============================================================================

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search company, role, location…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// ============================================================================
// Main table
// ============================================================================

export function SearchTable({ leads }: { leads: DiscoveredJob[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    // Default: newest posted first. (Discovered column was dropped — Posted
    // carries the recency info. postedAt can be null for adapters that
    // don't expose a date; those rows sort to the bottom.)
    { id: "postedAt", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) => {
      const search = String(value).trim().toLowerCase();
      if (!search) return true;
      const l = row.original;
      const haystack = [l.company, l.title, l.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const rows = table.getRowModel().rows;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  // Memoize so the filter input doesn't recompute "showing N–M of K" labels
  // on every keystroke unrelated to pagination.
  const pageLabel = useMemo(() => {
    if (totalRows === 0) return "0 of 0";
    const start = pageIndex * PAGE_SIZE + 1;
    const end = Math.min(start + rows.length - 1, totalRows);
    return `${start}–${end} of ${totalRows}`;
  }, [pageIndex, rows.length, totalRows]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <SearchBar value={globalFilter} onChange={setGlobalFilter} />

      <div className="rounded-lg border">
        {/*
          `table-fixed` makes columns honor their declared widths instead of
          growing to fit content. Combined with the per-column `size` on the
          column defs (rendered into `style={{ width }}` below), this keeps
          the table inside the viewport without horizontal scroll. The Role
          column has no `size` so it absorbs the remaining space.
        */}
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
                  {leads.length === 0
                    ? "No leads yet. Run a scrape from devtools (POST /api/scrape/run) to populate this list."
                    : "No leads match your search."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    // Long-content columns need to wrap rather than truncate;
                    // override the default whitespace-nowrap baked into
                    // TableCell. align-top so multi-line cells line up nicely
                    // with the single-line ones in the same row.
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

      {/* Pagination */}
      {totalRows > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{pageLabel}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="gap-1"
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
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
