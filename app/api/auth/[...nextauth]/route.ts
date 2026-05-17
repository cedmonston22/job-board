// Auth.js needs a catch-all route that handles callbacks, CSRF, session reads,
// the email-link verification endpoint, etc. The `handlers` object exported by
// auth.ts is `{ GET, POST }` — we destructure it and re-export so Next.js's
// router picks them up at every URL under /api/auth/*.
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
