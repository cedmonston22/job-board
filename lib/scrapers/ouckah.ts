// Ouckah-successor adapter — parses the vanshb03/Summer2026-Internships
// README. The original Ouckah repo was archived; vansh's fork is the
// active community-maintained list.
//
// Repo: https://github.com/vanshb03/Summer2026-Internships (main branch)
// Format: markdown pipe tables (different from Simplify's HTML tables).
// Row shape:
//
//   | Company | Role | Location | <a href="<APPLY_URL>"><img></a> | May 09 |
//
// Continuation rows have `↳` as the company cell (inherit previous).
// Location cells use `</br>` for line breaks and sometimes
// `<details><summary>X locations</summary>...</details>` for big multi-loc
// roles — we collapse both to comma-separated.
//
// Closed listings are tracked in a separate README in this repo, so we
// don't need to filter 🔒 here. Emojis in role text (🛂 🇺🇸 🔥 🎓) are
// stripped during normalization.

import crypto from "node:crypto";
import { htmlToText } from "../html-to-text";
import type { Adapter, RawJob } from "./types";

const FETCH_TIMEOUT_MS = 20_000;

const VANSH_README_URL =
  "https://raw.githubusercontent.com/vanshb03/Summer2026-Internships/main/README.md";

export const ouckahAdapter: Adapter = async () => {
  let res: Response;
  try {
    res = await fetch(VANSH_README_URL, {
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
      `vansh fetch failed for ${VANSH_README_URL}: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    throw new Error(`vansh: HTTP ${res.status}`);
  }

  const markdown = await res.text();
  return parsePipeTable(markdown);
};

// ============================================================================
// Pipe-table parser
// ============================================================================

// Match a pipe-row: starts with "| ", ends with "|", has internal pipes.
// We DON'T anchor to ^ because the line might have leading whitespace, but
// we DO require the first non-space char to be a pipe. Multiline.
// Group 1 is the row interior.
const ROW_REGEX = /^\s*\|(.+)\|\s*$/gm;
const HREF_REGEX = /href="([^"]+)"/;

function parsePipeTable(markdown: string): RawJob[] {
  const out: RawJob[] = [];
  let lastCompany: string | null = null;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = ROW_REGEX.exec(markdown)) !== null) {
    // Split the interior on `|`. The first and last empty entries (from the
    // leading/trailing pipes) are NOT created because we already trimmed
    // them off in the regex capture; remaining cells are the table columns.
    const cells = rowMatch[1].split("|").map((c) => c.trim());

    // Expect 5 cells (company, role, location, apply, date). Skip header
    // and separator rows: separators look like "| --- | --- | ... |".
    if (cells.length !== 5) continue;
    if (cells.every((c) => /^[-:\s]*$/.test(c))) continue;
    // Header row — first cell is literally "Company".
    if (cells[0].toLowerCase() === "company") continue;

    const [companyCell, roleCell, locationCell, applyCell, dateCell] = cells;

    // Company resolution (↳ → inherit).
    const companyText = stripMd(companyCell);
    const company =
      companyText === "↳" || companyText === "" ? lastCompany : companyText;
    if (!company) continue;
    if (companyText !== "↳" && companyText !== "")
      lastCompany = companyText;

    // Role — strip the inline emoji markers (🛂🇺🇸🔥🎓) and trim.
    const role = cleanRoleText(roleCell);
    if (!role) continue;

    // Location — handle <details><summary>...</summary>BODY</details> by
    // keeping only the body, then collapse <br>/</br> to commas.
    const location = parseLocation(locationCell);

    // Apply URL — must extract from the <a href="..."> in the cell.
    const hrefMatch = applyCell.match(HREF_REGEX);
    if (!hrefMatch) continue;
    const applyUrl = hrefMatch[1];

    // sourceId: hash the apply URL. Stable across runs because the URL
    // includes the upstream job ID.
    const sourceId = crypto
      .createHash("sha1")
      .update(applyUrl)
      .digest("hex")
      .slice(0, 16);

    out.push({
      sourceId,
      title: role,
      company,
      location: location || null,
      url: applyUrl,
      description: null, // not present in the table format
      postedAt: parseDateCell(dateCell),
    });
  }

  ROW_REGEX.lastIndex = 0;
  return out;
}

// Strip bold/link wrappers from a company cell (e.g. `**[Acme](url)**` → `Acme`).
function stripMd(cell: string): string {
  return cell
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Role text strips the eligibility-marker emojis but keeps the rest of the
// title intact (other emojis are rare and harmless if they slip through).
function cleanRoleText(cell: string): string {
  return cell
    .replace(/🛂|🇺🇸|🔥|🎓|🔒/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Locations can be plain ("San Francisco, CA"), multi-line via </br>, or
// wrapped in <details>...</details> for >3 locations.
function parseLocation(cell: string): string {
  // Strip the <details><summary>N locations</summary> wrapper, keep body.
  const detailsBody = cell.match(/<details>[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i);
  const inner = detailsBody ? detailsBody[1] : cell;
  // </br> and <br> → ", "
  return htmlToText(inner.replace(/<\/?br\s*\/?>/gi, ", ")).trim();
}

// "May 09" / "Jan 31" → Date in the current year. If the resulting date is
// in the future (e.g. parsing "Dec 20" in January), back it up a year.
function parseDateCell(cell: string): Date | null {
  const text = stripMd(cell);
  // Match "May 09" or "May 9"
  const m = text.match(/^([A-Za-z]{3,})\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const day = parseInt(m[2], 10);
  const now = new Date();
  let candidate = new Date(now.getFullYear(), month, day);
  if (candidate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    candidate = new Date(now.getFullYear() - 1, month, day);
  }
  return candidate;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
