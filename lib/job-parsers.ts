// JSON-LD JobPosting extractor.
//
// Most major ATS systems (Ashby, Greenhouse, Lever, Workday, BambooHR) embed a
// schema.org JobPosting block in their pages. It's the format Google Jobs reads
// and it's structured + reliable — far better than asking an LLM to parse HTML.
// We try this first in `parseJobFromUrl`; Groq is the fallback for sites that
// don't include it.

import type { ParsedJob } from "@/lib/zod-schemas";

// Matches every <script type="application/ld+json"> block, including ones with
// extra attributes (`data-...`) or different attribute order.
const SCRIPT_LD_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

type UnknownObj = Record<string, unknown>;

// Walks a parsed JSON-LD value looking for the first node whose @type is
// "JobPosting". Handles three shapes:
//   1. A JobPosting object at the top level.
//   2. An @graph array (schema.org's way of bundling multiple entities).
//   3. A plain array of nodes.
function findJobPosting(node: unknown): UnknownObj | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as UnknownObj;
  if (obj["@type"] === "JobPosting") return obj;
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  }
  return null;
}

// Strips HTML tags + decodes common entities. Used on the JobPosting
// `description` field which is typically HTML-formatted.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

// JobPosting's `jobLocation` can be a single Place, an array of Places, or
// missing. We extract one human-readable location string and infer
// remote/hybrid/onsite from the pattern of entries.
function pickLocation(loc: unknown): {
  location: string | null;
  remoteType: ParsedJob["remoteType"];
} {
  const items = Array.isArray(loc) ? loc : loc ? [loc] : [];

  let physical: string | null = null;
  let hasRemote = false;
  let hasOnsite = false;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const addr = (item as UnknownObj).address;
    if (!addr || typeof addr !== "object") continue;
    const a = addr as UnknownObj;
    const locality = asString(a.addressLocality);
    if (locality && locality.toLowerCase() === "remote") {
      hasRemote = true;
      continue;
    }
    if (locality) {
      hasOnsite = true;
      const region = asString(a.addressRegion);
      if (!physical) {
        physical = region ? `${locality}, ${region}` : locality;
      }
    }
  }

  let remoteType: ParsedJob["remoteType"] = null;
  if (hasRemote && hasOnsite) remoteType = "hybrid";
  else if (hasRemote) remoteType = "remote";
  else if (hasOnsite) remoteType = "onsite";

  return { location: physical, remoteType };
}

// Convert a salary value to an annual figure based on its unit. JobPosting's
// baseSalary uses schema.org QuantitativeValue, and unitText can be HOUR, DAY,
// WEEK, MONTH, or YEAR. We normalize to annual USD integers.
function toAnnual(unitText: string | null, value: number): number {
  if (!unitText) return Math.round(value);
  const u = unitText.toUpperCase();
  if (u === "HOUR") return Math.round(value * 40 * 52);
  if (u === "DAY") return Math.round(value * 5 * 52);
  if (u === "WEEK") return Math.round(value * 52);
  if (u === "MONTH") return Math.round(value * 12);
  // YEAR, ANNUAL, or unknown — pass through.
  return Math.round(value);
}

function extractSalary(baseSalary: unknown): {
  min: number | null;
  max: number | null;
} {
  if (!baseSalary || typeof baseSalary !== "object") {
    return { min: null, max: null };
  }
  const valueNode = (baseSalary as UnknownObj).value;
  if (!valueNode || typeof valueNode !== "object") {
    return { min: null, max: null };
  }
  const v = valueNode as UnknownObj;
  const unitText = asString(v.unitText);
  const minRaw = typeof v.minValue === "number" ? v.minValue : null;
  const maxRaw = typeof v.maxValue === "number" ? v.maxValue : null;
  const singleRaw = typeof v.value === "number" ? v.value : null;

  if (minRaw != null && maxRaw != null) {
    return {
      min: toAnnual(unitText, minRaw),
      max: toAnnual(unitText, maxRaw),
    };
  }
  if (singleRaw != null) {
    const annual = toAnnual(unitText, singleRaw);
    return { min: annual, max: annual };
  }
  return { min: null, max: null };
}

// Extracts a ParsedJob from any JSON-LD JobPosting present in the page HTML.
// Returns null if no JobPosting is found OR if parsing fails. Partial data
// (e.g. no salary) is fine — fields that aren't set come back as null.
export function extractFromJsonLd(html: string): ParsedJob | null {
  // Reset regex state — `lastIndex` is shared across calls when using `gi`.
  SCRIPT_LD_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = SCRIPT_LD_RE.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      // One bad block doesn't kill the search — some pages have multiple
      // JSON-LD scripts and only some are valid.
      continue;
    }

    const job = findJobPosting(parsed);
    if (!job) continue;

    const title = asString(job.title);

    const orgNode = job.hiringOrganization;
    const company =
      orgNode && typeof orgNode === "object"
        ? asString((orgNode as UnknownObj).name)
        : null;

    const descHtml = asString(job.description);
    const description = descHtml ? stripHtml(descHtml).slice(0, 20_000) : null;

    const { location, remoteType: locRemote } = pickLocation(job.jobLocation);

    // schema.org's `jobLocationType` is a strong remote signal — TELECOMMUTE
    // means the role can be performed remotely. If we ALSO have a physical
    // location, that's hybrid; otherwise pure remote.
    let remoteType: ParsedJob["remoteType"] = locRemote;
    if (asString(job.jobLocationType) === "TELECOMMUTE") {
      remoteType = location ? "hybrid" : "remote";
    }

    const { min: salaryMin, max: salaryMax } = extractSalary(job.baseSalary);

    return {
      title,
      company,
      location,
      remoteType,
      salaryMin,
      salaryMax,
      description,
    };
  }

  return null;
}
