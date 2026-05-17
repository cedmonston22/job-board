import Link from "next/link";
import { auth, signOut } from "@/auth";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function Home() {
  // auth() reads the session cookie and looks up the matching Session row in
  // the database. Returns null if not signed in. Because this is a server
  // component, the lookup happens server-side — the browser never sees the
  // raw query.
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Job Board</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Your personal job tracking dashboard.
        </p>

        {session?.user ? (
          <div className="mt-10 space-y-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Signed in as{" "}
              <span className="font-medium">
                {session.user.email ?? session.user.name}
              </span>
            </p>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-10">
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
