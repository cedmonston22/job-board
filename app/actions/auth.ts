"use server";

import { signOut } from "@/auth";

// Direct-call server action for signing out. Lives in its own file so client
// components (like the profile dropdown) can import and invoke it without
// pulling in the rest of `auth.ts` (which is server-only).
//
// `redirect: false` tells NextAuth to clear the session cookie + delete the
// Session row but NOT throw a NEXT_REDIRECT. The previous version used
// `redirectTo: "/login"` (default `redirect: true`), which threw a redirect
// the framework only follows when the action is invoked through useTransition
// / useActionState / a form action. The profile dropdown calls this via a
// plain click handler, so the redirect was being swallowed and the user
// stayed on the page despite being signed out. The client now navigates
// explicitly with router.push after awaiting this.
export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
}
