import Link from "next/link";
import { HeaderNav } from "@/components/header-nav";
import { ProfileMenu } from "@/components/profile-menu";

// The shared header rendered on every authed page. Server component so it can
// receive the session user directly from a Prisma/Auth.js call upstream
// without serializing through props.
//
// Layout: brand on the left, tab switcher (My Jobs | Job Search) in the
// middle, profile menu on the right.
export function Header({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}) {
  if (!user.email) {
    // Should be impossible because every page importing Header has already
    // run an auth gate, but TypeScript doesn't know that.
    return null;
  }

  return (
    <header className="flex items-center justify-between gap-6 border-b px-6 py-3">
      <Link
        href="/"
        className="text-lg font-semibold underline-offset-4 hover:underline"
      >
        Job Board
      </Link>
      <HeaderNav />
      <ProfileMenu
        user={{
          name: user.name ?? null,
          email: user.email,
          image: user.image ?? null,
        }}
      />
    </header>
  );
}
