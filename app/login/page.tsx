import { signIn } from "@/auth";

// Server actions: these functions run on the server when their form is
// submitted. The "use server" directive tells Next.js to expose them as RPC
// endpoints the browser can POST to. We can't just call signIn() at the top
// level — it mutates cookies and only runs inside a request.
async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signInWithEmail(formData: FormData) {
  "use server";
  await signIn("resend", formData);
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            to your job-board dashboard
          </p>
        </header>

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Continue with Google
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          or
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form action={signInWithEmail} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
