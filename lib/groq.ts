import Groq from "groq-sdk";

// Groq's SDK is a thin HTTP client — no persistent connections, no state worth
// reusing. But constructing it on every request reads `process.env` and runs
// validation, so we cache one instance per process (same pattern as
// `lib/prisma.ts`). The cache survives Next's dev-mode hot reload via globalThis.
function createGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env before calling the Groq API.",
    );
  }
  return new Groq({ apiKey });
}

const globalForGroq = globalThis as unknown as { groq?: Groq };

export const groq: Groq = globalForGroq.groq ?? createGroqClient();

if (process.env.NODE_ENV !== "production") {
  globalForGroq.groq = groq;
}

// The chat-completion model we use throughout the app. Centralized here so a
// future model upgrade is a one-line change.
export const GROQ_MODEL = "llama-3.3-70b-versatile";
