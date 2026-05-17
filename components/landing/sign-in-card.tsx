import { ClipboardList, Sparkles, Search } from "lucide-react";
import { signIn } from "@/auth";
import { GoogleIcon } from "@/components/landing/google-icon";
import { cn } from "@/lib/utils";

// Server action: runs on the server when the form submits.
async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export function SignInCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-zinc-200 bg-white/95 p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm",
        className,
      )}
    >
      {/* Wordmark row */}
      <div className="mb-6 flex items-center gap-2">
        <div
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white"
        >
          JB
        </div>
        <span className="text-sm font-medium text-zinc-900">Job Board</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Find and track every job in one place.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Pulled-in postings, AI fit scores, and contacts. Yours and only yours.
      </p>

      <ul className="mt-5 space-y-2.5 text-[13px] text-zinc-700">
        <li className="flex items-center gap-2.5">
          <ClipboardList className="size-4 shrink-0 text-zinc-500" />
          <span>Track applications across statuses</span>
        </li>
        <li className="flex items-center gap-2.5">
          <Sparkles className="size-4 shrink-0 text-zinc-500" />
          <span>AI-scored fit against your resume</span>
        </li>
        <li className="flex items-center gap-2.5">
          <Search className="size-4 shrink-0 text-zinc-500" />
          <span>Auto-discovered postings from 7 sources</span>
        </li>
      </ul>

      <div className="my-6 h-px bg-zinc-200" />

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          <GoogleIcon className="size-[18px]" />
          Continue with Google
        </button>
      </form>
    </div>
  );
}
