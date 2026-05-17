"use client";

import { Fragment, useOptimistic, useState, useTransition } from "react";
import {
  type ColumnDef,
  type ExpandedState,
  type Row,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Trash2Icon,
} from "lucide-react";
import { deleteJob, updateJobStatus } from "@/app/actions/jobs";
import type { Job, JobStatus } from "@/lib/generated/prisma/client";
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
// state — both come from the same useOptimistic hook on JobRow.
function JobRowDetail({ job, status }: { job: Job; status: JobStatus }) {
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

      {job.description ? (
        <div>
          <div className="mb-1 text-muted-foreground">Description</div>
          <p className="whitespace-pre-wrap">{job.description}</p>
        </div>
      ) : null}

      {job.notes ? (
        <div>
          <div className="mb-1 text-muted-foreground">Notes</div>
          <p className="whitespace-pre-wrap">{job.notes}</p>
        </div>
      ) : null}

      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Contacts & outreach coming in Phase 6.
      </div>

      <div className="flex justify-end border-t pt-3">
        <DeleteJobButton jobId={job.id} />
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value ?? <Dash />}</div>
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
// Column definitions
// ============================================================================

// Status column has no `cell` defined here — JobRow intercepts it so the
// dropdown reads the per-row optimistic state. The header still uses this
// definition.
const columns: ColumnDef<Job>[] = [
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Role",
  },
  {
    accessorKey: "status",
    header: "Status",
    // Cell rendered by JobRow — see comment above.
    cell: () => null,
  },
  {
    accessorKey: "fitScore",
    header: "Match %",
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      return v == null ? <Dash /> : <span>{v}%</span>;
    },
  },
  {
    accessorKey: "coverLetter",
    header: "Cover Letter",
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

// ============================================================================
// Per-row component
// ============================================================================

// JobRow owns the optimistic status for one row. Both the inline status
// dropdown (in the cell row) and the Status field (in the expanded detail
// panel) read from the same useOptimistic hook, so a status change reflects
// instantly in both places — no waiting for revalidatePath.
function JobRow({ row }: { row: Row<Job> }) {
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
        {cells.map((cell) =>
          cell.column.id === "status" ? (
            <TableCell key={cell.id}>
              <StatusSelect
                status={optimisticStatus}
                onChange={handleStatusChange}
              />
            </TableCell>
          ) : (
            <TableCell key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ),
        )}
      </TableRow>
      {row.getIsExpanded() ? (
        <TableRow>
          <TableCell colSpan={cells.length} className="p-0">
            <JobRowDetail job={job} status={optimisticStatus} />
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}

// ============================================================================
// Table
// ============================================================================

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data: jobs,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <JobRow key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
