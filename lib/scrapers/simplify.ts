// Simplify adapter — parses the HTML tables in SimplifyJobs's curated
// internship/new-grad READMEs.
//
// Source repos (markdown READMEs hosted as raw GitHub files):
//   - SimplifyJobs/Summer2026-Internships (dev branch)
//   - SimplifyJobs/New-Grad-Positions     (dev branch)
//
// Both READMEs use the SAME format: HTML `<table>` blocks with this row shape:
//
//   <tr>
//     <td><strong><a href="https://simplify.jobs/c/{Company}">CompanyName</a></strong></td>
//     <td>Role title</td>
//     <td>Location (may have <br> separators)</td>
//     <td><a href="<APPLY_URL>"><img ...></a> <a href="https://simplify.jobs/p/{UUID}">...</a></td>
//     <td>0d</td>                                          <!-- age in days/months -->
//   </tr>
//
// Continuation rows: the company cell is just `↳` and the role belongs to
// the PREVIOUS company. We inherit the company name in that case.
//
// Closed listings: rows containing 🔒 in the role cell — we skip those
// (they're not active applications).
//
// `sourceId`: we extract the simplify.jobs/p/{UUID} short-link and use the
// UUID. It's the most stable identifier the listing exposes.

import crypto from "node:crypto";
import { htmlToText } from "../html-to-text";
import type { Adapter, RawJob } from "./types";

const FETCH_TIMEOUT_MS = 20_000;

// Build a per-URL adapter. Used for both Summer and New-Grad — same parser,
// different README URL.
export function makeSimplifyAdapter(readmeUrl: string): Adapter {
  return async () => {
    let res: Response;
    try {
      res = await fetch(readmeUrl, {
        headers: {
          accept: "text/plain",
          "user-agent":
            "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(
        `Simplify fetch failed for ${readmeUrl}: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      throw new Error(`Simplify: HTTP ${res.status} for ${readmeUrl}`);
    }

    const markdown = await res.text();
    return parseSimplifyTables(markdown);
  };
}

// Exported separately for the New-Grad URL (kept in default-sources.ts).
export const SIMPLIFY_SUMMER_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md";
export const SIMPLIFY_NEWGRAD_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md";

// ============================================================================
// Parser internals
// ============================================================================

// Match each <tr>...</tr> in the document. Multiline because rows span lines.
const ROW_REGEX = /<tr>([\s\S]*?)<\/tr>/g;
// Within a row, capture each <td>...</td>. Same pattern.
const CELL_REGEX = /<td[^>]*>([\s\S]*?)<\/td>/g;
// Extract href values from an <a> tag.
const HREF_REGEX = /href="([^"]+)"/g;
// Simplify's stable short-link UUID.
const SIMPLIFY_PERMALINK_REGEX =
  /https:\/\/simplify\.jobs\/p\/([0-9a-f-]{36})/i;

function parseSimplifyTables(markdown: string): RawJob[] {
  const out: RawJob[] = [];
  // Track the most recent non-↳ company so continuation rows can inherit it.
  let lastCompany: string | null = null;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = ROW_REGEX.exec(markdown)) !== null) {
    const rowHtml = rowMatch[1];

    // Skip header rows — they sit inside <thead> and have <th> cells.
    if (rowHtml.includes("<th>") || rowHtml.includes("<th ")) continue;

    // Pull out the cells.
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    CELL_REGEX.lastIndex = 0;
    while ((cellMatch = CELL_REGEX.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }
    // Expect 5 cells: company | role | location | apply | age.
    // Tolerate a missing age cell (some sub-tables have only 4).
    if (cells.length < 4) continue;

    const [companyCell, roleCell, locationCell, applyCell, ageCell] = cells;

    // Resolve company — ↳ means "same as previous row's company."
    const companyText = htmlToText(companyCell).trim();
    const company =
      companyText === "↳" || companyText === ""
        ? lastCompany
        : companyText;
    if (!company) continue; // pathological — first row was a ↳
    if (companyText !== "↳" && companyText !== "")
      lastCompany = companyText;

    const role = htmlToText(roleCell).trim();
    if (!role) continue;
    // Closed listings are marked with a padlock in the role text.
    if (role.includes("🔒")) continue;

    // Location: strip tags, collapse `<br>` to commas first so multi-line
    // locations read as "San Francisco, CA, Berkeley, CA" instead of a run-on.
    const location = htmlToText(
      locationCell.replace(/<br\s*\/?>/gi, ", "),
    ).trim();

    // Apply URL: the first <a href> in the apply cell IS the actual job
    // application (Simplify renders it as the "Apply" image link). The
    // permalink (`simplify.jobs/p/UUID`) is the SECOND link and what we
    // use as the stable sourceId.
    const hrefs = extractHrefs(applyCell);
    if (hrefs.length === 0) continue;
    const applyUrl = hrefs[0];
    const permalink = hrefs.find((h) => SIMPLIFY_PERMALINK_REGEX.test(h));
    const uuidMatch = permalink?.match(SIMPLIFY_PERMALINK_REGEX);
    // Fall back to a hash of the apply URL if the permalink is missing
    // (rare — some rows skip the simplify.jobs/p/ link).
    const sourceId = uuidMatch
      ? uuidMatch[1]
      : crypto.createHash("sha1").update(applyUrl).digest("hex").slice(0, 16);

    // Posted date: derive from the "Age" column ("0d", "3d", "1mo"). Not
    // precise to the day but close enough for filtering 6-month-old stale.
    const postedAt = parseAge(ageCell ?? "");

    out.push({
      sourceId,
      title: role,
      company: company.trim(),
      location: location || null,
      url: applyUrl,
      // Simplify rows have no description in the table — that's by design.
      description: null,
      postedAt,
    });
  }

  // Reset regex state for the next call (g-flag regexes hold .lastIndex).
  ROW_REGEX.lastIndex = 0;
  CELL_REGEX.lastIndex = 0;
  return out;
}

function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  let m: RegExpExecArray | null;
  HREF_REGEX.lastIndex = 0;
  while ((m = HREF_REGEX.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  HREF_REGEX.lastIndex = 0;
  return hrefs;
}

// "0d" / "3d" / "1mo" / "12mo" → Date approximated by subtracting from now.
// Returns null on unparsable input.
function parseAge(cell: string): Date | null {
  const text = htmlToText(cell).trim();
  const m = text.match(/^(\d+)(d|mo)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const days = unit === "mo" ? n * 30 : n;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
