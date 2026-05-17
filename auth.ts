import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

// Auth.js v5 (the next major NextAuth release, still in beta) lets us
// centralise the entire auth configuration in one file. Calling NextAuth(...)
// returns four things we then re-export so the rest of the app can use them:
//
//   handlers — GET/POST functions wired to /api/auth/[...nextauth]
//   auth     — read the current session in server components / route handlers
//   signIn   — server action that starts a sign-in flow
//   signOut  — server action that destroys the session
//
// The PrismaAdapter persists Users, Accounts, Sessions and VerificationTokens
// to our Postgres database via the Prisma client we set up in lib/prisma.ts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // When called with no arguments, the provider reads AUTH_GOOGLE_ID and
    // AUTH_GOOGLE_SECRET from the environment automatically.
    Google,

    // Resend reads AUTH_RESEND_KEY from the environment. `from` is the email
    // address magic-link messages will be sent from — must be a verified
    // domain in Resend (or use onboarding@resend.dev during development).
    Resend({ from: process.env.EMAIL_FROM }),
  ],

  // Database-backed sessions: a Session row is created in Postgres on login
  // and the cookie just holds the sessionToken. The alternative ("jwt") puts
  // the whole session payload in a signed cookie — faster, but harder to
  // invalidate. With a database adapter, "database" is the right default.
  session: { strategy: "database" },

  // Custom login page so we control the look + add the Resend provider next
  // to Google in one UI. Without this, Auth.js renders its built-in page.
  pages: {
    signIn: "/login",
  },
});
