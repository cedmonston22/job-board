// Manual-trigger endpoint for the scrape runner. Auth-gated, POST-only.
//
// Used during development to verify each adapter end-to-end before the
// Vercel Cron (Phase 3.6) takes over the daily schedule.
//
// Trigger from devtools console:
//   await fetch("/api/scrape/run", { method: "POST" }).then(r => r.json())
// Or from curl (must include the session cookie):
//   curl -X POST http://localhost:3000/api/scrape/run \
//        -b "authjs.session-token=<token>"
//
// Response shape:
//   { pruned: number, sources: RunSummary[] }
// `pruned` is the count of stale leads deleted before fetching (see
// lib/scrapers/cleanup.ts). Each RunSummary has { source, label, fetched,
// kept, inserted, updated, errored }.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runScrapeForUser } from "@/lib/scrapers/runner";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runScrapeForUser(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    // runScrapeForUser already catches per-source errors and returns them
    // in the summary — reaching this catch means something unexpected blew
    // up (probably a Prisma issue). Log full detail server-side; return a
    // generic message.
    console.error("[scrape] runner crashed:", err);
    return new NextResponse("Scrape failed", { status: 500 });
  }
}
