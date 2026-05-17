"use client";

import {
  Fragment,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type FilterFn,
  type Row,
  type SortingFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { deleteJob, updateJobStatus } from "@/app/actions/jobs";
import type { Contact, Job, JobStatus } from "@/lib/generated/prisma/client";
import { ContactsSection } from "@/components/jobs/contacts-section";
import { JobSheet } from "@/components/jobs/job-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Job augmented with its contacts. The page query includes them; this type
// flows through the table to the detail panel.
export type JobWithContacts = Job & { contacts: Contact[] };
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ============================================================================
// Presentational cell components
// ============================================================================

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

// Color-coded badge for the Match % column. The bands match the score bands
// the LLM prompt is anchored to (lib/fit-scorer.ts):
//   ≥80 → green  (strong match: 70-89 + 90-100 in the prompt's bands)
//   50-79 → amber (decent match)
//    <50 → red   (weak / poor)
// `title` is the native browser tooltip on hover — shows the one-sentence
// summary if we have one. Quick & dep-free for now; a real Tooltip primitive
// can drop in later.
function FitBadge({ score, summary }: { score: number; summary: string | null }) {
  const tone =
    score >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : score >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
  return (
    <span
      title={summary ?? undefined}
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {score}
    </span>
  );
}

// Stateless status dropdown — the optimistic state lives on JobRow so the
// expanded detail panel can read the same value. This component just renders.
function StatusSelect({
  status,
  onChange,
}: {
  status: JobStatus;
  onChange: (value: JobStatus | null) => void;
}) {
  return (
    <Select value={status} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[110px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="SAVED">Saved</SelectItem>
        <SelectItem value="APPLIED">Applied</SelectItem>
        <SelectItem value="REJECTED">Rejected</SelectItem>
      </SelectContent>
    </Select>
  );
}

// The expanded panel below a row. Takes `status` as a prop (rather than reading
// from `job.status`) so the displayed value matches the dropdown's optimistic
// state — both come from the same useOptimistic hook on JobRow. The `onEdit`
// callback is wired by JobsTable to open the shared <JobSheet> in edit mode.
function JobRowDetail({
  job,
  status,
  onEdit,
}: {
  job: JobWithContacts;
  status: JobStatus;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-4 bg-muted/30 p-4 text-sm">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailField label="Location" value={job.location} />
        <DetailField
          label="Workplace"
          value={job.remoteType ? capitalize(job.remoteType) : null}
        />
        <DetailField
          label="Salary"
          value={formatSalary(job.salaryMin, job.salaryMax)}
        />
        <DetailField
          label="Status"
          value={formatStatus(
            status,
            job.createdAt,
            job.appliedAt,
            job.rejectedAt,
          )}
        />
      </div>

      {job.url ? (
        <div>
          <div className="mb-1 text-muted-foreground">URL</div>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline-offset-4 hover:underline"
          >
            {job.url}
          </a>
        </div>
      ) : null}

      {job.description ? <DescriptionDisclosure text={job.description} /> : null}

      {job.notes ? (
        <div>
          <div className="mb-1 text-muted-foreground">Notes</div>
          <p className="whitespace-pre-wrap">{job.notes}</p>
        </div>
      ) : null}

      <ContactsSection
        jobId={job.id}
        company={job.company}
        contacts={job.contacts}
      />

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="gap-1"
        >
          <PencilIcon className="size-4" />
          Edit
        </Button>
        <DeleteJobButton jobId={job.id} />
      </div>
    </div>
  );
}

// Description is heavy text — usually only consulted when needed, so we hide
// it behind a one-click disclosure. The text still lives in the DB (Phase 4/5
// AI features depend on it); the panel just doesn't dump it visually by default.
function DescriptionDisclosure({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {open ? "Hide description" : "Show description"}
      </button>
      {open ? (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-background/50 p-3 text-sm">
          {text}
        </p>
      ) : null}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    // min-w-0 lets this grid cell shrink below its content's intrinsic
    // width — without it, a long unbroken value would push out the grid
    // track and force horizontal scroll. break-words is the corresponding
    // permission to wrap long values inside.
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words">{value ?? <Dash />}</div>
    </div>
  );
}

// Two-step delete: first click reveals an inline Cancel / Confirm pair. The
// transition wrapping `deleteJob` keeps `pending` true until the server returns
// and revalidatePath removes the row from the page's data.
function DeleteJobButton({ jobId }: { jobId: string }) {
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
      <span className="text-xs text-muted-foreground">Delete this job?</span>
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
            await deleteJob(jobId);
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatStatus(
  status: JobStatus,
  createdAt: Date,
  appliedAt: Date | null,
  rejectedAt: Date | null,
): string {
  // Each status has its own transition timestamp:
  //   SAVED    → createdAt   (when the job was first added)
  //   APPLIED  → appliedAt   (stamped on transition into APPLIED)
  //   REJECTED → rejectedAt  (stamped on transition into REJECTED)
  // Jobs that pre-date the rejectedAt migration may have null rejectedAt — we
  // fall through to just the label in that case.
  if (status === "SAVED") return `Saved (${formatDate(createdAt)})`;
  if (status === "APPLIED") {
    return appliedAt ? `Applied (${formatDate(appliedAt)})` : "Applied";
  }
  return rejectedAt ? `Rejected (${formatDate(rejectedAt)})` : "Rejected";
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min != null && max != null) {
    return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  }
  return fmt((min ?? max) as number);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

// ============================================================================
// Sort / filter helpers
// ============================================================================

// Status sorts in pipeline order, not alphabetical: SAVED → APPLIED → REJECTED.
// Alphabetical (APPLIED, REJECTED, SAVED) would feel random.
const STATUS_ORDER: Record<JobStatus, number> = {
  SAVED: 0,
  APPLIED: 1,
  REJECTED: 2,
};

const statusSortingFn: SortingFn<JobWithContacts> = (a, b) =>
  STATUS_ORDER[a.original.status] - STATUS_ORDER[b.original.status];

// Global filter: case-insensitive substring search across the fields that make
// sense to search by. Includes `description` (autofilled JD text) so a search
// for keywords like "react" or "typescript" finds matching postings even
// though description isn't a visible column.
const globalFilterFn: FilterFn<JobWithContacts> = (row, _columnId, value) => {
  const search = String(value).trim().toLowerCase();
  if (!search) return true;
  const j = row.original;
  const haystack = [j.company, j.title, j.location, j.notes, j.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
};

// Search input: lives above the table, spans the full width of the main column.
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
        placeholder="Search company, role, location, notes, description…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// All the filter values the sidebar manages, hoisted into one type so the
// JobsTable owner and the sidebar speak the same language.
export type SidebarFilters = {
  status: "ALL" | JobStatus;
  company: string; // "ALL" or a specific company name
  roleSort: "DEFAULT" | "ASC" | "DESC";
  matchSort: "DEFAULT" | "DESC" | "ASC"; // DESC = highest first, ASC = lowest first
};

// One labeled section of the sidebar. Layout repeats for every filter — pulling
// it out keeps the JSX in FiltersSidebar readable.
function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FiltersSidebar({
  filters,
  onChange,
  statusCounts,
  companies,
}: {
  filters: SidebarFilters;
  onChange: (next: SidebarFilters) => void;
  statusCounts: {
    ALL: number;
    SAVED: number;
    APPLIED: number;
    REJECTED: number;
  };
  companies: string[];
}) {
  // Each handler builds a fresh SidebarFilters object so the parent can replace
  // its single state value in one setState call.
  const set = <K extends keyof SidebarFilters>(
    key: K,
    value: SidebarFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <aside className="w-full shrink-0 md:w-56">
      <div className="grid gap-4 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Filters</h3>

        {/* Status */}
        <SidebarSection label="Status">
          <Select
            value={filters.status}
            onValueChange={(v) => {
              if (v) set("status", v as SidebarFilters["status"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All ({statusCounts.ALL})</SelectItem>
              <SelectItem value="SAVED">
                Saved ({statusCounts.SAVED})
              </SelectItem>
              <SelectItem value="APPLIED">
                Applied ({statusCounts.APPLIED})
              </SelectItem>
              <SelectItem value="REJECTED">
                Rejected ({statusCounts.REJECTED})
              </SelectItem>
            </SelectContent>
          </Select>
        </SidebarSection>

        {/* Company */}
        <SidebarSection label="Company">
          <Select
            value={filters.company}
            onValueChange={(v) => {
              if (v) set("company", v);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SidebarSection>

        {/* Role */}
        <SidebarSection label="Role">
          <Select
            value={filters.roleSort}
            onValueChange={(v) => {
              if (v) set("roleSort", v as SidebarFilters["roleSort"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEFAULT">Default</SelectItem>
              <SelectItem value="ASC">Sort A → Z</SelectItem>
              <SelectItem value="DESC">Sort Z → A</SelectItem>
            </SelectContent>
          </Select>
        </SidebarSection>

        {/* Match % */}
        <SidebarSection label="Match %">
          <Select
            value={filters.matchSort}
            onValueChange={(v) => {
              if (v) set("matchSort", v as SidebarFilters["matchSort"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEFAULT">Default</SelectItem>
              <SelectItem value="DESC">Highest first</SelectItem>
              <SelectItem value="ASC">Lowest first</SelectItem>
            </SelectContent>
          </Select>
        </SidebarSection>
      </div>
    </aside>
  );
}

// ============================================================================
// Column definitions
// ============================================================================

// Column widths in pixels. The table uses `table-fixed` (see render below),
// so these are enforced. Role gets no `size` — under table-fixed, the
// unspecified column absorbs all remaining width, which means long role
// titles get the most room.
//
// Status column has no `cell` defined here — JobRow intercepts it so the
// dropdown reads the per-row optimistic state. The header still uses this
// definition.
const columns: ColumnDef<JobWithContacts>[] = [
  {
    accessorKey: "company",
    header: "Company",
    size: 130,
    // Sidebar company dropdown filters via exact-match.
    filterFn: "equalsString",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Role",
    // No size → flex column under table-fixed.
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 130,
    sortingFn: statusSortingFn,
    // The sidebar status dropdown triggers exact-match filtering on this id.
    filterFn: "equalsString",
    // Cell rendered by JobRow with optimistic state — see comment above.
    cell: () => null,
  },
  {
    accessorKey: "fitScore",
    header: "Match",
    size: 90,
    // nulls sort last so jobs without a fit score don't crowd the top.
    sortUndefined: "last",
    cell: ({ row, getValue }) => {
      const v = getValue<number | null>();
      if (v == null) return <Dash />;
      return <FitBadge score={v} summary={row.original.fitSummary} />;
    },
  },
  {
    accessorKey: "coverLetter",
    header: "Cover Letter",
    size: 110,
    enableSorting: false,
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v == null ? (
        <Dash />
      ) : (
        <span className="text-primary">View</span>
      );
    },
  },
  {
    id: "more",
    header: "",
    size: 96,
    enableSorting: false,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={row.getToggleExpandedHandler()}
        className="gap-1"
      >
        {row.getIsExpanded() ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        More
      </Button>
    ),
  },
];

// Long-content cells that need to wrap rather than truncate. The default
// TableCell from components/ui/table.tsx ships with `whitespace-nowrap`;
// this set tells the row renderer to override that for the named columns.
const WRAPPING_COLUMNS = new Set(["company", "title"]);

// ============================================================================
// Per-row component
// ============================================================================

// JobRow owns the optimistic status for one row. Both the inline status
// dropdown (in the cell row) and the Status field (in the expanded detail
// panel) read from the same useOptimistic hook, so a status change reflects
// instantly in both places — no waiting for revalidatePath.
function JobRow({
  row,
  onEdit,
}: {
  row: Row<JobWithContacts>;
  onEdit: (job: JobWithContacts) => void;
}) {
  const job = row.original;
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(job.status);
  const [, startTransition] = useTransition();

  function handleStatusChange(value: JobStatus | null) {
    if (!value) return;
    startTransition(async () => {
      setOptimisticStatus(value);
      await updateJobStatus(job.id, value);
    });
  }

  const cells = row.getVisibleCells();

  return (
    <Fragment>
      <TableRow>
        {cells.map((cell) => {
          // align-top + whitespace-normal lets long role titles wrap into
          // multiple lines instead of stretching the column.
          const wraps = WRAPPING_COLUMNS.has(cell.column.id);
          const className = wraps ? "whitespace-normal align-top" : undefined;
          return cell.column.id === "status" ? (
            <TableCell key={cell.id} className={className}>
              <StatusSelect
                status={optimisticStatus}
                onChange={handleStatusChange}
              />
            </TableCell>
          ) : (
            <TableCell key={cell.id} className={className}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          );
        })}
      </TableRow>
      {row.getIsExpanded() ? (
        <TableRow>
          {/*
            whitespace-normal overrides the default TableCell's nowrap
            so long content inside the expanded panel (URLs, descriptions,
            notes, contact details) can wrap to the cell's width instead
            of overflowing the table.
          */}
          <TableCell
            colSpan={cells.length}
            className="whitespace-normal p-0"
          >
            <JobRowDetail
              job={job}
              status={optimisticStatus}
              onEdit={() => onEdit(job)}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}

// ============================================================================
// Table
// ============================================================================

export function JobsTable({ jobs }: { jobs: JobWithContacts[] }) {
  // ---- table state ----
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [filters, setFilters] = useState<SidebarFilters>({
    status: "ALL",
    company: "ALL",
    roleSort: "DEFAULT",
    matchSort: "DEFAULT",
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [editingJob, setEditingJob] = useState<JobWithContacts | null>(null);

  // Column filters are derived from the sidebar's filter state. We emit only
  // the entries that are actually narrowing (skipping the "ALL" sentinel).
  // useMemo keeps the array identity stable when nothing relevant changed —
  // otherwise TanStack would re-run the filter pipeline on every unrelated
  // render (e.g. typing in the search box).
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const c: ColumnFiltersState = [];
    if (filters.status !== "ALL") {
      c.push({ id: "status", value: filters.status });
    }
    if (filters.company !== "ALL") {
      c.push({ id: "company", value: filters.company });
    }
    return c;
  }, [filters.status, filters.company]);

  // Role and Match % dropdowns are shortcuts for setting the table's sort
  // state. Both can be active at once (multi-sort): pick Role A→Z and Match
  // Highest, and rows sort by role first, then by match within ties.
  function applyColumnSort(
    sorting: SortingState,
    columnId: string,
    direction: "DEFAULT" | "ASC" | "DESC",
  ): SortingState {
    const others = sorting.filter((entry) => entry.id !== columnId);
    if (direction === "DEFAULT") return others;
    return [...others, { id: columnId, desc: direction === "DESC" }];
  }

  function handleFiltersChange(next: SidebarFilters) {
    if (next.roleSort !== filters.roleSort) {
      setSorting((s) => applyColumnSort(s, "title", next.roleSort));
    }
    if (next.matchSort !== filters.matchSort) {
      setSorting((s) => applyColumnSort(s, "fitScore", next.matchSort));
    }
    setFilters(next);
  }

  const table = useReactTable({
    data: jobs,
    columns,
    state: { sorting, globalFilter, columnFilters, expanded },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const rows = table.getRowModel().rows;
  const noMatches = rows.length === 0 && jobs.length > 0;

  // Status counts off the unfiltered data — what shows in the dropdown labels.
  // Memoized so we don't re-tally on every search keystroke.
  const statusCounts = useMemo(() => {
    const c = { ALL: jobs.length, SAVED: 0, APPLIED: 0, REJECTED: 0 };
    for (const job of jobs) c[job.status]++;
    return c;
  }, [jobs]);

  // Sorted unique company list for the Company dropdown options.
  const companies = useMemo(() => {
    const set = new Set(jobs.map((j) => j.company));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  function clearFilters() {
    setGlobalFilter("");
    handleFiltersChange({
      status: "ALL",
      company: "ALL",
      roleSort: "DEFAULT",
      matchSort: "DEFAULT",
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row">
        <FiltersSidebar
          filters={filters}
          onChange={handleFiltersChange}
          statusCounts={statusCounts}
          companies={companies}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <SearchBar value={globalFilter} onChange={setGlobalFilter} />

          <div className="rounded-lg border">
            {/*
              `table-fixed` makes columns honor their declared widths
              instead of growing to fit content. Combined with per-column
              `size` on the column defs (rendered into `style={{ width }}`
              below), this keeps the table inside the viewport without
              horizontal scroll. The Role column has no `size` so it
              absorbs the remaining space.
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
                {noMatches ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No jobs match your filters.{" "}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Clear filters
                      </button>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <JobRow key={row.id} row={row} onEdit={setEditingJob} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {editingJob !== null ? (
        <JobSheet
          key={editingJob.id}
          job={editingJob}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingJob(null);
          }}
        />
      ) : null}
    </>
  );
}
