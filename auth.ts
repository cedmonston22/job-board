import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
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
// The PrismaAdapter persists Users, Accounts, and Sessions to our Postgres
// database via the Prisma client we set up in lib/prisma.ts. (The schema also
// has a VerificationToken table; it sits empty until we add a magic-link
// provider later.)
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // When called with no arguments, the provider reads AUTH_GOOGLE_ID and
    // AUTH_GOOGLE_SECRET from the environment automatically.
    Google,
  ],

  // Database-backed sessions: a Session row is created in Postgres on login
  // and the cookie just holds the sessionToken. The alternative ("jwt") puts
  // the whole session payload in a signed cookie — faster, but harder to
  // invalidate. With a database adapter, "database" is the right default.
  session: { strategy: "database" },

  // Custom login page so we control the look. Without this, Auth.js renders
  // its built-in page.
  pages: {
    signIn: "/login",
  },
});
