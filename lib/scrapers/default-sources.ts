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
//     If the page loads with openings, the slug is valid. Even better: probe
//     the JSON endpoint directly (boards-api.greenhouse.io/v1/boards/{slug}/jobs,
//     api.lever.co/v0/postings/{slug}?mode=json, api.ashbyhq.com/posting-api/job-board/{slug})
//     and confirm 200 + a non-empty response before adding.
//   - For Workday, identifier is "{tenant}/wd{N}/{site}" — three slash-
//     delimited segments. Find these by visiting the company's public
//     careers page and looking for a URL like
//     `https://{tenant}.wd5.myworkdayjobs.com/{site}`. The {site} segment
//     is CASE-SENSITIVE in Workday's routing — copy it exactly. Verify by
//     POSTing to https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
//     with body `{"appliedFacets":{},"limit":1,"offset":0,"searchText":""}`
//     and expecting HTTP 200. A 422 means the tenant/wdN are right but the
//     {site} is wrong; a 404 means the wdN datacenter or tenant is wrong.
//   - For a global feed (RemoteOK, Simplify*, Ouckah*), there's exactly one
//     entry per type — already listed below. No `identifier` needed.
//
// `label` is what shows up in the Job Search tab next to each result.
//
// Slug-rot policy: a 404 every cron run forever is worse than a missing
// company. If a slug stops working, REMOVE the row (don't comment it out
// half-heartedly) and leave a one-liner about why in the section header.

import type { ScrapeSourceTypeInput } from "../zod-schemas";

export type DefaultSource = {
  type: ScrapeSourceTypeInput;
  identifier: string | null; // company slug for ATS; null for global feeds
  label: string;
};

export const DEFAULT_SOURCES: DefaultSource[] = [
  // -------------------------------------------------------------------------
  // Greenhouse (ATS)
  // -------------------------------------------------------------------------
  // Verify each slug at boards.greenhouse.io/{slug} (or directly via
  // boards-api.greenhouse.io/v1/boards/{slug}/jobs) before adding.
  // Coinbase removed 2026-05-17 — migrated off Greenhouse/Lever/Ashby.

  // Tech — verified 2026-05-18
  { type: "GREENHOUSE", identifier: "stripe", label: "Stripe" },
  { type: "GREENHOUSE", identifier: "airbnb", label: "Airbnb" },
  { type: "GREENHOUSE", identifier: "instacart", label: "Instacart" },
  { type: "GREENHOUSE", identifier: "robinhood", label: "Robinhood" },
  { type: "GREENHOUSE", identifier: "figma", label: "Figma" },
  { type: "GREENHOUSE", identifier: "brex", label: "Brex" },
  { type: "GREENHOUSE", identifier: "anthropic", label: "Anthropic" },
  { type: "GREENHOUSE", identifier: "scaleai", label: "Scale AI" },
  { type: "GREENHOUSE", identifier: "mercury", label: "Mercury" },
  { type: "GREENHOUSE", identifier: "nuro", label: "Nuro" },
  { type: "GREENHOUSE", identifier: "databricks", label: "Databricks" },
  { type: "GREENHOUSE", identifier: "chime", label: "Chime" },
  { type: "GREENHOUSE", identifier: "gusto", label: "Gusto" },
  { type: "GREENHOUSE", identifier: "faire", label: "Faire" },
  { type: "GREENHOUSE", identifier: "discord", label: "Discord" },
  { type: "GREENHOUSE", identifier: "twitch", label: "Twitch" },
  { type: "GREENHOUSE", identifier: "reddit", label: "Reddit" },
  { type: "GREENHOUSE", identifier: "pinterest", label: "Pinterest" },
  { type: "GREENHOUSE", identifier: "samsara", label: "Samsara" },
  { type: "GREENHOUSE", identifier: "affirm", label: "Affirm" },
  { type: "GREENHOUSE", identifier: "dropbox", label: "Dropbox" },
  { type: "GREENHOUSE", identifier: "squarespace", label: "Squarespace" },
  { type: "GREENHOUSE", identifier: "roblox", label: "Roblox" },
  { type: "GREENHOUSE", identifier: "lyft", label: "Lyft" },
  { type: "GREENHOUSE", identifier: "peloton", label: "Peloton" },
  { type: "GREENHOUSE", identifier: "duolingo", label: "Duolingo" },
  { type: "GREENHOUSE", identifier: "asana", label: "Asana" },
  { type: "GREENHOUSE", identifier: "twilio", label: "Twilio" },
  { type: "GREENHOUSE", identifier: "cloudflare", label: "Cloudflare" },
  { type: "GREENHOUSE", identifier: "spacex", label: "SpaceX" },
  { type: "GREENHOUSE", identifier: "flexport", label: "Flexport" },
  { type: "GREENHOUSE", identifier: "gitlab", label: "GitLab" },

  // Non-tech — verified 2026-05-18
  { type: "GREENHOUSE", identifier: "sweetgreen", label: "Sweetgreen" },
  { type: "GREENHOUSE", identifier: "oscar", label: "Oscar Health" },
  { type: "GREENHOUSE", identifier: "buzzfeed", label: "BuzzFeed" },
  { type: "GREENHOUSE", identifier: "disney", label: "Disney" },
  { type: "GREENHOUSE", identifier: "modernhealth", label: "Modern Health" },

  // -------------------------------------------------------------------------
  // Lever (ATS)
  // -------------------------------------------------------------------------
  // Verify each slug at jobs.lever.co/{slug} before adding. Note: many
  // companies have migrated OFF Lever over the last year — probe each
  // candidate via api.lever.co/v0/postings/{slug}?mode=json and confirm
  // 200 + non-empty array before adding.

  // Verified 2026-05-18
  { type: "LEVER", identifier: "palantir", label: "Palantir" },
  { type: "LEVER", identifier: "attentive", label: "Attentive" },
  { type: "LEVER", identifier: "netflix", label: "Netflix" },
  { type: "LEVER", identifier: "spotify", label: "Spotify" },
  { type: "LEVER", identifier: "everlywell", label: "Everlywell" },
  // Plaid removed 2026-05-18 — Lever endpoint now 404s; they moved ATS.

  // -------------------------------------------------------------------------
  // Ashby (ATS)
  // -------------------------------------------------------------------------
  // Verify each slug at jobs.ashbyhq.com/{slug} before adding.

  // Tech — verified 2026-05-18
  { type: "ASHBY", identifier: "openai", label: "OpenAI" },
  { type: "ASHBY", identifier: "linear", label: "Linear" },
  { type: "ASHBY", identifier: "vercel", label: "Vercel" },
  { type: "ASHBY", identifier: "ramp", label: "Ramp" },
  { type: "ASHBY", identifier: "notion", label: "Notion" },
  { type: "ASHBY", identifier: "cursor", label: "Cursor" },
  // ashby/mercury exists but returns an empty board — Mercury Bank's real
  // listings are on Greenhouse (added above). Don't reintroduce.
  { type: "ASHBY", identifier: "elevenlabs", label: "ElevenLabs" },
  { type: "ASHBY", identifier: "perplexity", label: "Perplexity" },
  { type: "ASHBY", identifier: "replit", label: "Replit" },
  { type: "ASHBY", identifier: "posthog", label: "PostHog" },
  { type: "ASHBY", identifier: "supabase", label: "Supabase" },
  { type: "ASHBY", identifier: "vanta", label: "Vanta" },
  { type: "ASHBY", identifier: "stytch", label: "Stytch" },
  { type: "ASHBY", identifier: "resend", label: "Resend" },
  { type: "ASHBY", identifier: "watershed", label: "Watershed" },
  { type: "ASHBY", identifier: "nylas", label: "Nylas" },
  { type: "ASHBY", identifier: "airtable", label: "Airtable" },
  { type: "ASHBY", identifier: "cohere", label: "Cohere" },

  // -------------------------------------------------------------------------
  // Workday (ATS — large enterprises, non-tech bias)
  // -------------------------------------------------------------------------
  // Identifier format: "{tenant}/wd{N}/{site}". See header comment for how
  // to discover these. Each entry below was probed against the CXS jobs
  // endpoint on 2026-05-18 and returned HTTP 200 with non-empty
  // jobPostings. The {site} segment IS case-sensitive — match the casing
  // exactly as found on the company's public careers URL.
  //
  // Many Fortune-500 careers pages use Workday but route through SPA
  // wrappers that obscure the tenant URL. We add only verified-working
  // tenants here; expanding requires manually finding each
  // {tenant}.wd{N}.myworkdayjobs.com/{site} link.

  // Retail / CPG
  { type: "WORKDAY", identifier: "walmart/wd5/WalmartExternal", label: "Walmart" },
  { type: "WORKDAY", identifier: "target/wd5/targetcareers", label: "Target" },

  // Finance
  { type: "WORKDAY", identifier: "blackrock/wd1/BlackRock_Professional", label: "BlackRock" },
  { type: "WORKDAY", identifier: "capitalone/wd12/Capital_One", label: "Capital One" },
  { type: "WORKDAY", identifier: "mastercard/wd1/CorporateCareers", label: "Mastercard" },
  { type: "WORKDAY", identifier: "ms/wd5/External", label: "Morgan Stanley" },

  // Consulting
  { type: "WORKDAY", identifier: "pwc/wd3/Global_Experienced_Careers", label: "PwC" },

  // Healthcare / pharma
  { type: "WORKDAY", identifier: "pfizer/wd1/PfizerCareers", label: "Pfizer" },
  { type: "WORKDAY", identifier: "philips/wd3/jobs-and-careers", label: "Philips" },

  // Tech (Workday-hosted)
  { type: "WORKDAY", identifier: "nvidia/wd5/NVIDIAExternalCareerSite", label: "NVIDIA" },
  { type: "WORKDAY", identifier: "salesforce/wd12/External_Career_Site", label: "Salesforce" },
  { type: "WORKDAY", identifier: "tmobile/wd1/External", label: "T-Mobile" },

  // -------------------------------------------------------------------------
  // Global feeds
  // -------------------------------------------------------------------------
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
