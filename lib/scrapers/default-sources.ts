// The hardcoded list of scrape targets. No UI for configuring this — edit
// the array below and redeploy. Per the project's Option-C decision (Phase
// 3.2), source config is an implementation detail, not a user surface.
//
// Adding a new target:
//   - For an ATS company (Greenhouse, Lever, Ashby), append a row with the
//     company's public slug. Verify by visiting:
//       boards.greenhouse.io/{slug}     (Greenhouse)
//       jobs.lever.co/{slug}            (Lever)
//       jobs.ashbyhq.com/{slug}         (Ashby)
//     If the page loads with openings, the slug is valid.
//   - For a global feed (RemoteOK, Simplify*, Ouckah*), there's exactly one
//     entry per type — already listed below. No `identifier` needed.
//
// `label` is what shows up in the Job Search tab next to each result.

import type { ScrapeSourceTypeInput } from "../zod-schemas";

export type DefaultSource = {
  type: ScrapeSourceTypeInput;
  identifier: string | null; // company slug for ATS; null for global feeds
  label: string;
};

export const DEFAULT_SOURCES: DefaultSource[] = [
  // ----- Greenhouse (ATS) -----
  // Verify each slug at boards.greenhouse.io/{slug} before adding.
  { type: "GREENHOUSE", identifier: "stripe", label: "Stripe" },
  { type: "GREENHOUSE", identifier: "airbnb", label: "Airbnb" },
  { type: "GREENHOUSE", identifier: "instacart", label: "Instacart" },
  { type: "GREENHOUSE", identifier: "robinhood", label: "Robinhood" },
  // Coinbase removed 2026-05-17 — Greenhouse returns 404; they migrated
  // off Greenhouse/Lever/Ashby (likely Workday or custom ATS, neither
  // supported by our adapter set).

  // ----- Lever (ATS) -----
  // Verify each slug at jobs.lever.co/{slug} before adding.
  // Note: many companies have migrated OFF Lever over the last year. Probe
  // each candidate via `api.lever.co/v0/postings/{slug}?mode=json` and
  // confirm 200 + non-empty array before adding.
  { type: "LEVER", identifier: "palantir", label: "Palantir" },
  { type: "LEVER", identifier: "plaid", label: "Plaid" },
  { type: "LEVER", identifier: "attentive", label: "Attentive" },

  // ----- Ashby (ATS) -----
  // Verify each slug at jobs.ashbyhq.com/{slug} before adding.
  { type: "ASHBY", identifier: "openai", label: "OpenAI" },
  { type: "ASHBY", identifier: "linear", label: "Linear" },
  { type: "ASHBY", identifier: "vercel", label: "Vercel" },
  { type: "ASHBY", identifier: "ramp", label: "Ramp (Ashby)" },

  // ----- Global feeds -----
  // One per type — these don't take a slug.
  { type: "REMOTEOK", identifier: null, label: "RemoteOK" },
  {
    type: "SIMPLIFY_SUMMER",
    identifier: null,
    label: "Simplify · Summer 2026 Internships",
  },
  {
    type: "SIMPLIFY_NEWGRAD",
    identifier: null,
    label: "Simplify · New Grad Positions",
  },
  {
    // Enum still says OUCKAH_SUMMER (internal id, kept stable) but the
    // adapter now scrapes vanshb03's repo — the original Ouckah list was
    // archived; vansh's fork is the active community-maintained successor.
    type: "OUCKAH_SUMMER",
    identifier: null,
    label: "vansh · Summer 2026 Internships",
  },
];
