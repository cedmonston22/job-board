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
