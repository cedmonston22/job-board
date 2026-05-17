import { signIn } from "@/auth";

// Server action: runs on the server when the form is submitted. The
// "use server" directive tells Next.js to expose this as an RPC endpoint the
// browser can POST to.
async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
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
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
