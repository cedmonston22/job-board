"use server";

import { signOut } from "@/auth";

// Direct-call server action for signing out. Lives in its own file so client
// components (like the profile dropdown) can import and invoke it without
// pulling in the rest of `auth.ts` (which is server-only).
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
