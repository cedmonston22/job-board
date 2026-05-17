// Vercel Cron entry point — runs the scrape for every user in the DB.
//
// Scheduling lives in vercel.json (`/api/cron/scrape` daily at 11:00 UTC).
// Vercel hits this endpoint as a regular GET request and includes
// `Authorization: Bearer ${CRON_SECRET}` so we can distinguish legit
// scheduled invocations from random internet traffic. Without that header
// (or with the wrong secret) we 401.
//
// Auth model is intentionally different from /api/scrape/run:
//   - /api/scrape/run   uses the user session (per-user manual trigger)
//   - /api/cron/scrape  uses CRON_SECRET (no session — Vercel runs it)
//
// Setup checklist (do once):
//   1. Vercel dashboard → Project → Settings → Environment Variables
//   2. Add CRON_SECRET = <any long random string, e.g. `openssl rand -hex 32`>
//   3. Make sure vercel.json is committed and deployed
//   4. Vercel auto-detects the crons entry on next deploy

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runScrapeForUser } from "@/lib/scrapers/runner";

// Bump the default 10s timeout — the scrape can take 30-60s when many
// adapters return large lists. 60s is the Hobby tier cap; Pro allows 300s.
export const maxDuration = 60;

// Vercel ignores caching for cron routes anyway, but explicit is good.
export const dynamic = "force-dynamic";

type UserResult = {
  userId: string;
  ok: boolean;
  pruned?: number;
  sourceCount?: number;
  error?: string;
};

export async function GET(request: NextRequest) {
  // Validate the cron secret. Without CRON_SECRET configured, deny
  // everything — better to fail closed than accidentally expose a
  // public scrape trigger.
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Fetch every user. For a solo app this is one row; the structure
  // scales to multi-user later without changes.
  const users = await prisma.user.findMany({ select: { id: true } });

  // Run sequentially per user. Each user's scrape is internally parallel
  // (Promise.allSettled across sources), so the bottleneck stays bounded
  // per user. Running users in parallel could overwhelm Groq quotas or
  // upstream APIs and isn't needed at this scale.
  const results: UserResult[] = [];
  for (const user of users) {
    try {
      const r = await runScrapeForUser(user.id);
      results.push({
        userId: user.id,
        ok: true,
        pruned: r.pruned,
        sourceCount: r.sources.length,
      });
    } catch (err) {
      // Per-user failure isolated — log the detail, keep going so one
      // user's bad config doesn't break everyone else's scrape.
      console.error(`[cron/scrape] user ${user.id} failed:`, err);
      results.push({
        userId: user.id,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    userCount: users.length,
    results,
  });
}
