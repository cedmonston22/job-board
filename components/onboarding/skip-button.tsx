"use client";

import { useTransition } from "react";
import { skipOnboarding } from "@/app/actions/onboarding";

// Client-side wrapper for the "Skip for now" link on the onboarding page.
// Calls the server action via useTransition rather than wiring it as a
// <form action> — the form-action path was 404ing in dev (server action
// endpoint not registered until the dev server rebuilt its manifest).
// Calling the action through a transition is the canonical pattern for
// server actions that take no form data.
export function SkipButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await skipOnboarding();
        });
      }}
      className="rounded text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {pending ? "Skipping…" : "Skip for now"}
    </button>
  );
}
