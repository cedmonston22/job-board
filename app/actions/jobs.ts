"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groq, GROQ_MODEL } from "@/lib/groq";
import { extractFromJsonLd } from "@/lib/job-parsers";
import { scoreJobAndStore } from "@/lib/score-job";
import {
  jobInputSchema,
  jobStatusSchema,
  parsedJobSchema,
  type JobStatusInput,
  type ParsedJob,
} from "@/lib/zod-schemas";

// Shape of the value returned by every form action. Components use
// `useActionState` to render `fieldErrors` next to inputs and `error` at the
// top of the form.
export type JobActionState = {
  ok: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
  error?: string;
};

// Every action below short-circuits with a redirect if the user isn't logged
// in. Returning an id (rather than the whole session) keeps later code tight.
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

// ----- createJob -----
// Signature matches what `useActionState` expects: (prevState, formData).
// The first argument is unused — Next passes the previous return value back in
// so you can keep state across submissions if you want to.
export async function createJob(
  _prev: JobActionState | undefined,
  formData: FormData,
): Promise<JobActionState> {
  const userId = await requireUserId();

  const parsed = jobInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const created = await prisma.job.create({
    data: {
      ...parsed.data,
      userId,
      // If a job is created already-applied, stamp the time so we can show
      // "applied 3 days ago" in the table later.
      appliedAt: parsed.data.status === "APPLIED" ? new Date() : null,
    },
    select: { id: true },
  });

  // Tell Next.js the cached homepage data is stale so the new job shows up.
  revalidatePath("/");

  // Kick off AI fit scoring AFTER the response has been sent — see Next.js
  // `after()` docs. The Save button feels instant to the user; the fit
  // score lands a few seconds later and shows up on the dashboard's next
  // refresh (the helper calls revalidatePath itself when it's done).
  after(() => scoreJobAndStore(userId, created.id));

  return { ok: true };
}

// ----- updateJob -----
// The id comes in as the first argument; in the component we'll `.bind` it
// before passing the action to `useActionState`.
export async function updateJob(
  id: string,
  _prev: JobActionState | undefined,
  formData: FormData,
): Promise<JobActionState> {
  const userId = await requireUserId();

  const parsed = jobInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Look up the row's current state so we can detect a status transition.
  const existing = await prisma.job.findFirst({
    where: { id, userId },
    select: { status: true, appliedAt: true, rejectedAt: true },
  });
  if (!existing) return { ok: false, error: "Job not found" };

  const justAppliedNow =
    parsed.data.status === "APPLIED" && existing.status !== "APPLIED";
  const justRejectedNow =
    parsed.data.status === "REJECTED" && existing.status !== "REJECTED";

  // updateMany takes a non-unique `where`, which lets us combine id + userId
  // as the filter. This prevents a malicious request from updating another
  // user's row by guessing an id.
  const result = await prisma.job.updateMany({
    where: { id, userId },
    data: {
      ...parsed.data,
      // Stamp transition timestamps only on the move INTO that status. If they
      // edit an already-applied job, keep the original applied date.
      ...(justAppliedNow && { appliedAt: new Date() }),
      ...(justRejectedNow && { rejectedAt: new Date() }),
    },
  });

  if (result.count === 0) return { ok: false, error: "Job not found" };

  revalidatePath("/");
  return { ok: true };
}

// ----- updateJobStatus -----
// Direct-call action (no FormData) — used by the inline status dropdown in the
// table. The client component invokes this as `await updateJobStatus(id, val)`.
export async function updateJobStatus(
  id: string,
  status: JobStatusInput,
): Promise<JobActionState> {
  const userId = await requireUserId();

  const parsed = jobStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const existing = await prisma.job.findFirst({
    where: { id, userId },
    select: { status: true, appliedAt: true, rejectedAt: true },
  });
  if (!existing) return { ok: false, error: "Job not found" };

  const justAppliedNow =
    parsed.data === "APPLIED" && existing.status !== "APPLIED";
  const justRejectedNow =
    parsed.data === "REJECTED" && existing.status !== "REJECTED";

  await prisma.job.updateMany({
    where: { id, userId },
    data: {
      status: parsed.data,
      ...(justAppliedNow && { appliedAt: new Date() }),
      ...(justRejectedNow && { rejectedAt: new Date() }),
    },
  });

  revalidatePath("/");
  return { ok: true };
}

// ----- parseJobFromUrl -----
// Fetches a job-posting URL, asks Groq to extract structured fields, and
// returns them to the client for prefilling the AddJobSheet form. Pure read
// operation — does not touch the database.
export type ParseJobFromUrlResult =
  | { ok: true; data: ParsedJob }
  | { ok: false; error: string };

// Tiny URL validator — same constraint as the form field. Inline because it's
// the only place we use it and full schema overhead is unnecessary.
const urlOnlySchema = z.url();

// Cap how much page text we send to Groq. Llama 3.3 has a 128k-token context,
// but most postings are well under 10k chars of real content; padding past
// ~50k just burns tokens and slows the response.
const MAX_TEXT_CHARS = 50_000;

export async function parseJobFromUrl(
  url: string,
): Promise<ParseJobFromUrlResult> {
  // Auth-gate: we don't write anything but we still don't want anonymous
  // traffic burning our Groq quota.
  await requireUserId();

  // 1. Validate the URL.
  const parsedUrl = urlOnlySchema.safeParse(url);
  if (!parsedUrl.success) {
    return { ok: false, error: "Please enter a valid URL." };
  }

  // 2. Fetch the page HTML. Many sites block default user agents, so we set a
  // browser-like one. `cache: "no-store"` skips Next's fetch cache so retries
  // re-hit the source.
  let html: string;
  try {
    const res = await fetch(parsedUrl.data, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JobBoardBot/1.0; +https://github.com/cedmonst22/job-board)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      // 15s — most pages return in under 2s; this guards against hanging.
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, error: `Couldn't reach that URL (${res.status}).` };
    }
    html = await res.text();
  } catch {
    // Network error, timeout, DNS failure — all surface as one user-facing msg.
    return { ok: false, error: "Couldn't reach that URL." };
  }

  // 3. Try JSON-LD JobPosting extraction first. This is the schema.org standard
  // that Ashby, Greenhouse, Lever, Workday and most other ATSs embed in their
  // pages. Structured, accurate, and free — no LLM round-trip needed.
  const jsonLd = extractFromJsonLd(html);
  if (jsonLd && (jsonLd.title || jsonLd.company)) {
    return { ok: true, data: jsonLd };
  }

  // 4. Fallback: strip HTML to plain text and ask Groq to extract. Used for
  // sites that don't embed JSON-LD (custom company /careers pages, etc.).
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
  if (text.length < 50) {
    return {
      ok: false,
      error:
        "This page loads its content with JavaScript (common on LinkedIn, Indeed, and many big-company SPAs). Try a Greenhouse, Lever, Ashby, or /careers page — or add manually.",
    };
  }

  // 5. Ask Groq for structured JSON.
  let raw: unknown;
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: JOB_PARSE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `URL: ${parsedUrl.data}\n\nPage text:\n${text}`,
        },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "AI returned no content. Try again." };
    }
    raw = JSON.parse(content);
  } catch (err) {
    console.error("Groq parse failed:", err);
    return { ok: false, error: "AI parse failed. Try again." };
  }

  // 6. Validate Groq's output. Never trust an LLM — even with JSON mode the
  // shape can drift. On failure, log and surface a generic error.
  const parsed = parsedJobSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Groq response failed validation:", parsed.error);
    return { ok: false, error: "AI returned an unexpected shape." };
  }

  // If Groq returned nulls for everything, the page wasn't a job posting.
  const anyValue = Object.values(parsed.data).some((v) => v != null);
  if (!anyValue) {
    return {
      ok: false,
      error: "AI couldn't find job details on this page. Try adding manually.",
    };
  }

  return { ok: true, data: parsed.data };
}

// Strip tags, kill <script>/<style> content entirely (text inside is never
// useful), collapse whitespace. Order matters: scripts and styles first so we
// don't keep their bodies after generic tag stripping.
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
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

const JOB_PARSE_SYSTEM_PROMPT = `You extract structured job-posting data from web pages.

You will receive the URL and plain-text contents of a job posting. Return a JSON object with exactly these keys:

{
  "title":       string | null,  // the role title, e.g. "Senior Software Engineer"
  "company":     string | null,  // the hiring company's name
  "location":    string | null,  // city/region, e.g. "San Francisco, CA" — null if not stated
  "remoteType":  "remote" | "hybrid" | "onsite" | null,
  "salaryMin":   integer | null, // annual USD, integer dollars (e.g. 120000) — null if not listed
  "salaryMax":   integer | null,
  "description": string | null   // a clean 2–5 sentence summary of the role and responsibilities
}

Rules:
- Return STRICT JSON with exactly these keys. No prose, no markdown, no extra keys.
- If a field is not stated on the page, return null. NEVER guess or hallucinate.
- For salary: integer dollars only, USD. If only an hourly rate is given, compute annual = rate * 40 * 52. If only a range like "$120k-$180k" is given, salaryMin=120000, salaryMax=180000. If only one number is given, set both min and max to that number.
- For remoteType: only the three allowed strings. Map common variants ("WFH" → "remote", "in-office" → "onsite", "flexible" → "hybrid"). If unclear, return null.
- description should be a short factual summary, not marketing copy.`;

// ----- deleteJob -----
export async function deleteJob(id: string): Promise<JobActionState> {
  const userId = await requireUserId();

  const result = await prisma.job.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) return { ok: false, error: "Job not found" };

  // Clear importedJobId on any DiscoveredJob rows that pointed at the
  // deleted Job. Without this, the search page's "In Your Jobs" badge
  // would keep showing because lead.importedJobId still has the (now
  // dangling) id. With it cleared, the lead's "Add to My Jobs" button
  // comes back so the user can re-import.
  await prisma.discoveredJob.updateMany({
    where: { userId, importedJobId: id },
    data: { importedJobId: null },
  });

  // Both surfaces are stale: dashboard loses the row, search page may
  // need to update the badge → button on a matching lead.
  revalidatePath("/");
  revalidatePath("/jobs/search");
  return { ok: true };
}
