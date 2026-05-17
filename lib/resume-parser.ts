// Resume parser. Takes the plain text extracted in step 2.3 and asks Groq to
// return structured data matching `parsedResumeSchema`.
//
// Same pattern as `parseJobFromUrl`: temperature low, JSON mode on, then
// double-validate with Zod after JSON.parse. Never trust LLM output shape.

import { groq, GROQ_MODEL } from "@/lib/groq";
import { parsedResumeSchema, type ParsedResume } from "@/lib/zod-schemas";

export type ParseResumeResult =
  | { ok: true; data: ParsedResume }
  | { ok: false; error: string };

// Cap input size — sufficient for 99% of resumes and keeps token cost
// predictable. A typical resume runs 1500–4000 chars after extraction.
const MAX_INPUT_CHARS = 30_000;

export async function parseResumeText(text: string): Promise<ParseResumeResult> {
  const input = text.slice(0, MAX_INPUT_CHARS);
  if (input.length < 50) {
    return { ok: false, error: "Not enough text to parse." };
  }

  let raw: unknown;
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RESUME_PARSE_SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { ok: false, error: "AI returned no content." };
    raw = JSON.parse(content);
  } catch (err) {
    console.error("Groq resume parse failed:", err);
    return { ok: false, error: "AI parse failed. Try again." };
  }

  const parsed = parsedResumeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Parsed resume validation failed:", parsed.error);
    return { ok: false, error: "AI returned an unexpected shape." };
  }

  return { ok: true, data: parsed.data };
}

const RESUME_PARSE_SYSTEM_PROMPT = `You extract structured data from resume text and return it as JSON.

Return STRICT JSON matching this schema exactly. Do not include any prose, markdown, or extra keys.

{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "linkedinUrl": string | null,
  "websiteUrl": string | null,
  "summary": string | null,
  "workExperience": [
    {
      "company": string,
      "role": string,
      "location": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "isCurrent": boolean,
      "bullets": string[]
    }
  ],
  "education": [
    {
      "school": string,
      "degree": string | null,
      "field": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "gpa": string | null
    }
  ],
  "skills": string[],
  "projects": [
    {
      "name": string,
      "description": string | null,
      "technologies": string[]
    }
  ]
}

Rules:
- Return ONLY the JSON object. No prose, no markdown fences.
- Use null when a value isn't stated on the resume. Never guess or fabricate.
- "name" is the person's full name as it appears at the top of the resume.
- "location" should be "City, State" or "City, Country" format.
- Dates: keep the original format from the resume (e.g. "Jan 2023", "2023-01", "2023").
- "isCurrent": true if the role/program has no end date or says "Present", "Current", or "Now". When true, endDate should be null.
- "bullets": each achievement or responsibility as a separate string in the array. Strip leading bullet characters (•, *, -, ·, etc.) and surrounding whitespace.
- "skills": one flat array of individual skill names. Do not group by category. If the resume lists "Languages: Python, Java", split into ["Python", "Java"].
- "linkedinUrl" / "websiteUrl": full URLs as written. If the resume just says "linkedin.com/in/john", include the full https:// prefix.
- If a section is missing entirely (no projects, no education), return [] for that field — never null.
- workExperience, education, skills, and projects MUST always be arrays.`;
