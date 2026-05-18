import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import type { ScrapeTrigger } from "@/lib/generated/prisma/client";

// Small server-rendered status pill in the /jobs/search header that
// answers "did the cron actually run?". Without it, a silent CRON_SECRET
// misconfiguration on Vercel is invisible until the user notices the
// data going stale weeks later — exactly the scenario that prompted the
// ScrapeRun audit table in the first place.
//
// States:
//   - never ran   → "Last updated 2:50 PM PST" (hardcoded placeholder
//                    until the next scrape writes a real row; the user
//                    explicitly asked for this preview state)
//   - ok          → green check, absolute timestamp + trigger + counts
//   - errored     → amber triangle, absolute timestamp + error preview
//   - in-flight   → animated clock, "running…"
//
// Times render as absolute clock time in Pacific (e.g. "2:50 PM PST").
// We hardcode the "PST" suffix per the spec — technically inaccurate
// during DST (May–Nov is PDT) but matches the explicit request. Swap to
// `timeZoneName: "short"` if you want automatic PDT/PST switching.

type LastRun = {
  trigger: ScrapeTrigger;
  startedAt: Date;
  finishedAt: Date | null;
  ok: boolean;
  inserted: number;
  updated: number;
  sourcesErrored: number;
  errorMessage: string | null;
} | null;

// Hardcoded placeholder shown while we have zero rows in ScrapeRun. The
// real time format produced by formatPacificTime() matches this exactly
// (e.g. "2:50 PM PST") so swapping in a real timestamp is visually
// seamless.
const PLACEHOLDER_TIME = "2:50 PM PST";

export function ScrapeStatusPill({ lastRun }: { lastRun: LastRun }) {
  if (!lastRun) {
    return (
      <Pill tone="muted" icon={<Clock className="size-3" />}>
        <span>Last updated {PLACEHOLDER_TIME}</span>
      </Pill>
    );
  }

  // finishedAt null + recent startedAt = still in flight. After ~10 min
  // assume the row was orphaned (crash before the finally-block ran);
  // surface as an error rather than spinning forever.
  const elapsedMs = Date.now() - lastRun.startedAt.getTime();
  const STALE_INFLIGHT_MS = 10 * 60 * 1000;
  const inFlight = lastRun.finishedAt === null && elapsedMs < STALE_INFLIGHT_MS;

  if (inFlight) {
    return (
      <Pill tone="muted" icon={<Clock className="size-3 animate-pulse" />}>
        <span>Scrape running · {triggerLabel(lastRun.trigger)}</span>
      </Pill>
    );
  }

  const timestamp = formatPacificTime(lastRun.startedAt);
  const trigger = triggerLabel(lastRun.trigger);

  // `ok: false` OR a stuck in-flight row → error state. We show the first
  // line of errorMessage (truncated). When there's no message but
  // sourcesErrored is set, that's the partial-failure case where every
  // source had a problem; surface a generic note.
  if (!lastRun.ok || lastRun.finishedAt === null) {
    const detail =
      lastRun.errorMessage?.split("\n")[0].slice(0, 80) ??
      (lastRun.sourcesErrored > 0
        ? `${lastRun.sourcesErrored} source(s) failed`
        : "Failed");
    return (
      <Pill tone="error" icon={<AlertTriangle className="size-3" />}>
        <span>
          Last updated {timestamp} · {trigger} · {detail}
        </span>
      </Pill>
    );
  }

  // Success path. `inserted + updated` is the most user-meaningful
  // single number — "this is how much fresh data landed." sourcesErrored
  // > 0 still shows in green because the overall run succeeded; it's a
  // soft caveat appended after the counts.
  const fresh = lastRun.inserted + lastRun.updated;
  const partialNote =
    lastRun.sourcesErrored > 0
      ? ` · ${lastRun.sourcesErrored} source(s) erred`
      : "";

  return (
    <Pill tone="ok" icon={<CheckCircle2 className="size-3" />}>
      <span>
        Last updated {timestamp} · {trigger} · {fresh.toLocaleString()} jobs
        {partialNote}
      </span>
    </Pill>
  );
}

function Pill({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "error" | "muted";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  return (
    <div
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses}`}
    >
      {icon}
      {children}
    </div>
  );
}

function triggerLabel(trigger: ScrapeTrigger): string {
  return trigger === "CRON" ? "auto" : "manual";
}

// Render a Date as Pacific clock time + " PST" suffix, e.g. "2:50 PM PST".
// Uses `Intl.DateTimeFormat` with the IANA `America/Los_Angeles` zone so
// the math is correct regardless of the server's locale or DST state —
// but we manually append "PST" instead of relying on `timeZoneName:
// "short"` because the user asked for the literal "PST" label.
//
// One important detail: this runs on the SERVER (the page is a server
// component). Server-rendered timestamps with `Intl.DateTimeFormat` are
// deterministic in Node regardless of host timezone as long as we pin
// `timeZone` — no hydration mismatch risk because no client render
// recomputes this. If we ever move this to a client component, switch
// to `useFormatter` or hydrate-safe approach.
function formatPacificTime(date: Date): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${time} PST`;
}
