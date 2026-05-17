import { z } from "zod";

// FormData values are always strings. Empty inputs come through as "" rather
// than `undefined`, which would otherwise pass length checks. This helper
// converts "" → undefined so optional fields behave correctly.
const emptyToUndefined = (val: unknown) =>
  val === "" || val === null ? undefined : val;

// The three job statuses we support in Phase 1. Matches the Prisma `JobStatus`
// enum exactly — if you add a value here, also `prisma migrate` it.
export const jobStatusSchema = z.enum(["SAVED", "APPLIED", "REJECTED"]);
export type JobStatusInput = z.infer<typeof jobStatusSchema>;

// What a valid job submission looks like coming out of a browser form.
// All fields except `title` and `company` are optional. Zod runs each rule in
// order, top-down: empty-to-undefined first, then the actual type check.
export const jobInputSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Too long"),
    company: z.string().min(1, "Company is required").max(100, "Too long"),

    location: z.preprocess(
      emptyToUndefined,
      z.string().max(100).optional(),
    ),
    remoteType: z.preprocess(
      emptyToUndefined,
      z.string().max(20).optional(),
    ),
    url: z.preprocess(
      emptyToUndefined,
      z.url("Must be a valid URL").optional(),
    ),

    // `z.coerce.number()` parses string → number. Useful since FormData hands
    // us strings even for numeric inputs.
    salaryMin: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().nonnegative().optional(),
    ),
    salaryMax: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().nonnegative().optional(),
    ),

    description: z.preprocess(
      emptyToUndefined,
      z.string().max(20000).optional(),
    ),
    notes: z.preprocess(
      emptyToUndefined,
      z.string().max(5000).optional(),
    ),

    status: jobStatusSchema.default("SAVED"),
  })
  // `.refine` adds a cross-field validation rule. We attach the error to
  // `salaryMin` so the form can render it next to that input.
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMin <= data.salaryMax,
    {
      message: "Min salary must be less than or equal to max",
      path: ["salaryMin"],
    },
  );

export type JobInput = z.infer<typeof jobInputSchema>;

// Shape we expect Groq to return when parsing a job-posting URL. All fields are
// nullable: the model is instructed to return `null` when a value is not
// explicitly stated on the page (rather than guessing). After parsing we hand
// these values to the AddJobSheet to prefill the form, so the user sees and
// can correct anything before saving.
export const parsedJobSchema = z.object({
  title: z.string().min(1).max(200).nullable(),
  company: z.string().min(1).max(100).nullable(),
  location: z.string().max(100).nullable(),
  remoteType: z.enum(["remote", "hybrid", "onsite"]).nullable(),
  salaryMin: z.number().int().nonnegative().nullable(),
  salaryMax: z.number().int().nonnegative().nullable(),
  description: z.string().max(20000).nullable(),
});

export type ParsedJob = z.infer<typeof parsedJobSchema>;

// What a valid contact submission looks like. `name` is required — everything
// else is optional and goes through the same empty-string-to-undefined dance
// as the job form fields.
export const contactInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  role: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  linkedinUrl: z.preprocess(
    emptyToUndefined,
    z.url("Must be a valid URL").optional(),
  ),
  email: z.preprocess(
    emptyToUndefined,
    z.email("Must be a valid email").optional(),
  ),
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

// Shape we expect Groq to return when parsing the extracted text of a resume.
// Used both to validate the LLM response AND as the source of truth for the
// `ParsedResume` type that the UI components consume.
//
// Most string fields are nullable because resumes vary wildly — not every
// resume has a summary, GPA, etc. The array fields (workExperience, education,
// skills, projects) MUST be arrays, defaulting to [] when absent.
export const parsedResumeSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  summary: z.string().nullable(),

  workExperience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      bullets: z.array(z.string()),
    }),
  ),

  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      gpa: z.string().nullable(),
    }),
  ),

  skills: z.array(z.string()),

  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      technologies: z.array(z.string()),
    }),
  ),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
