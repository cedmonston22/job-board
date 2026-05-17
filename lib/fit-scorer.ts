// Fit scorer. Takes the user's extracted resume text + the job they're tracking
// and asks Groq to return a structured match assessment.
//
// Same recipe as `lib/resume-parser.ts`:
//   - low temperature for stable, repeatable scores
//   - JSON mode on so the model can't drift into prose
//   - double-validate with Zod after JSON.parse — never trust LLM shape

import { groq, GROQ_MODEL } from "@/lib/groq";
import { fitResultSchema, type FitResult } from "@/lib/zod-schemas";

// What the caller needs to hand us about the job. Mirrors a subset of the
// Prisma `Job` row — kept here as a plain shape so the scorer doesn't import
// the generated Prisma types (heavy + drags the client into wrong bundles).
export type FitScoreJobInput = {
  title: string;
  company: string;
  description: string | null;
};

export type ScoreFitResult =
  | { ok: true; data: FitResult }
  | { ok: false; error: string };

// Token-budget caps. Llama 3.3 has 128k tokens (~500k chars) of context, but
// keeping the prompt tight makes responses faster and cheaper. Most resumes
// are 1.5–4k chars and most JDs run 500–5k chars after stripping HTML.
const MAX_RESUME_CHARS = 30_000;
const MAX_JD_CHARS = 20_000;

// Below this many chars of JD text we don't even try — a title-only score
// from Groq is mostly noise and would burn a request for no signal. The
// caller leaves fit fields null and the table renders "—".
const MIN_JD_CHARS = 50;

export async function scoreFit(
  resumeText: string,
  job: FitScoreJobInput,
): Promise<ScoreFitResult> {
  const resume = resumeText.slice(0, MAX_RESUME_CHARS);
  if (resume.length < 50) {
    return { ok: false, error: "Resume text is too short to score." };
  }

  const description = (job.description ?? "").slice(0, MAX_JD_CHARS);
  if (description.length < MIN_JD_CHARS) {
    return {
      ok: false,
      error: "Job description is too short to score — add one to enable AI fit scoring.",
    };
  }

  // Build the user message. We label each section so the model can't confuse
  // resume bullets with JD bullets.
  const userPrompt =
    `RESUME:\n${resume}\n\n` +
    `JOB:\n` +
    `Title: ${job.title}\n` +
    `Company: ${job.company}\n` +
    `Description:\n${description}`;

  let raw: unknown;
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      // 0.1 keeps the score stable across re-scores of the same pair —
      // important since the user may click "Re-score" to debug a result.
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: FIT_SCORE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { ok: false, error: "AI returned no content." };
    raw = JSON.parse(content);
  } catch (err) {
    console.error("Groq fit score failed:", err);
    return { ok: false, error: "AI scoring failed. Try again." };
  }

  // Zod double-check — caps array sizes + string lengths, rejects shape drift.
  const parsed = fitResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Fit score validation failed:", parsed.error);
    return { ok: false, error: "AI returned an unexpected shape." };
  }

  return { ok: true, data: parsed.data };
}

// The score bands and the explicit "cite the resume" / "cite the JD" guidance
// are the most important parts of this prompt — without them Groq returns
// generic platitudes ("strong communicator", "team player") instead of
// specific, grounded matches.
const FIT_SCORE_SYSTEM_PROMPT = `You score how well a candidate's resume matches a job description.

Return STRICT JSON matching this schema exactly. No prose, no markdown, no extra keys.

{
  "score": integer 0-100,
  "summary": string (one sentence, max 200 chars),
  "strengths": string[] (3-5 items),
  "gaps": string[] (3-5 items)
}

Score bands (anchor to these — don't drift):
- 90-100: near-perfect match. Almost every required skill, similar role level, same domain.
- 70-89:  strong match. Most required skills present, similar level, only minor gaps.
- 50-69:  decent match. Key skills present, real gaps in level or specialty area.
- 30-49:  weak match. Some overlap but significant mismatches (level, domain, or skill set).
- 0-29:   poor match. Resume is largely unrelated to this role.

Rules for strengths:
- Each item must cite a SPECIFIC point from the resume tied to a SPECIFIC requirement from the JD.
- Good: "5 years of Python at Stripe directly matches the JD's backend Python requirement."
- Bad:  "Strong technical skills." / "Good cultural fit."
- 3 to 5 items. Each item under 200 chars.

Rules for gaps:
- Each item must name a SPECIFIC JD requirement the resume does not clearly meet.
- Good: "JD requires Kubernetes experience; resume mentions Docker but not K8s."
- Bad:  "Could be a stretch role."
- 3 to 5 items. If the resume genuinely covers everything, return an empty list — do not invent gaps.

Rules for summary:
- One sentence, max 200 chars.
- Lead with the verdict ("Strong match because…", "Decent match but…", "Weak match — …").
- Cite the single biggest reason behind the score.

Calibration:
- Do not pad strengths to make the candidate feel better. Be honest.
- Do not penalize for missing "nice-to-haves" — focus on the must-have requirements.
- If the JD lists 10+ requirements and the resume covers 8, that's a strong match (80+), not a "weak match because they're missing 2 things."`;
