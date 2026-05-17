// Fetches a job posting page and pulls out the job description text.
// Used as a fallback in `lib/score-job.ts` when a Job is being scored but
// has no `description` yet (typically a Simplify or Ouckah lead — those
// scrapers only ingest a markdown table with title + company + link, no
// JD text).
//
// Two-tier strategy, fastest first:
//   1. JSON-LD JobPosting block (free, structured, accurate). Greenhouse,
//      Lever, Ashby, Workday and most major ATSs ship one. Hits the 95% case.
//   2. Groq extraction from stripped HTML. Slower + costs one extra Groq
//      call, but covers small/custom careers pages that don't embed JSON-LD.
//
// What we CAN'T fix from this helper: SPAs like LinkedIn and Indeed return
// an empty HTML shell to a server-side fetch — neither JSON-LD nor Groq
// has anything to read. Those return null and the job stays unscored.

import { extractFromJsonLd } from "@/lib/job-parsers";
import { htmlToText } from "@/lib/html-to-text";
import { groq, GROQ_MODEL } from "@/lib/groq";

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
  accept: "text/html,application/xhtml+xml",
} as const;

const FETCH_TIMEOUT_MS = 15_000;

// Hard cap on stored description length. Mirrors the scrapers + the cap in
// `lib/fit-scorer.ts`.
const MAX_DESCRIPTION_CHARS = 20_000;

// How much HTML→text we feed Groq in the fallback. Most job postings run
// well under this; Llama 3.3 has 128k tokens of context so headroom is fine.
const MAX_GROQ_INPUT_CHARS = 50_000;

// Below this much text after stripping, we don't even try Groq — it's
// almost certainly a SPA shell with no real content.
const MIN_TEXT_FOR_GROQ = 200;

export async function fetchJobDescriptionFromUrl(
  url: string,
): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch (err) {
    console.warn(`fetchJobDescriptionFromUrl: fetch failed for ${url}:`, err);
    return null;
  }

  // ----- Tier 1: JSON-LD -----
  const jsonLd = extractFromJsonLd(html);
  if (jsonLd?.description) {
    return jsonLd.description.slice(0, MAX_DESCRIPTION_CHARS);
  }

  // ----- Tier 2: Groq fallback -----
  // Strip HTML to text and ask Groq for just the description. Bail if the
  // stripped page is too short — almost certainly a SPA shell.
  const text = htmlToText(html).slice(0, MAX_GROQ_INPUT_CHARS);
  if (text.length < MIN_TEXT_FOR_GROQ) return null;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DESCRIPTION_EXTRACT_PROMPT },
        { role: "user", content: `URL: ${url}\n\nPage text:\n${text}` },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const raw = JSON.parse(content) as { description?: unknown };
    const desc =
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : null;
    if (!desc) return null;

    return desc.slice(0, MAX_DESCRIPTION_CHARS);
  } catch (err) {
    console.warn(`fetchJobDescriptionFromUrl: Groq fallback failed for ${url}:`, err);
    return null;
  }
}

// Tighter than parseJobFromUrl's prompt — we only need the description, so
// the schema is dead simple and the rules focus on "actual JD vs nav junk".
const DESCRIPTION_EXTRACT_PROMPT = `You extract the job description text from a job-posting web page.

Return STRICT JSON with exactly one key:

{ "description": string | null }

Rules:
- "description" is the actual role description: what the company does, what the role entails, responsibilities, requirements, qualifications.
- If the page is NOT a job posting (404 page, login wall, SPA shell, blog post), return { "description": null }.
- Exclude nav menus, cookie banners, footers, "About the company" boilerplate, application form fields, and "Equal Opportunity Employer" statements.
- Preserve paragraph breaks with single newlines. Do not output markdown.
- 2 to 30 short paragraphs is typical. If the page only has a sentence or two of actual content, return null — that's not enough to score against.
- Return ONLY the JSON object. No prose, no markdown fences.`;
