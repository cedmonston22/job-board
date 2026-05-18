"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The avatar + email button in the header, plus the dropdown menu it opens.
// Client component because the dropdown logic (open/close, focus management)
// runs in the browser.
export function ProfileMenu({
  user,
}: {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-full p-0.5 pr-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Profile menu"
          >
            <Avatar src={user.image} name={user.name} email={user.email} />
            <span className="hidden text-muted-foreground sm:inline">
              {user.email}
            </span>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        {/* Header block doubles as a Profile link — full-area click target. */}
        <DropdownMenuItem
          render={
            <Link
              href="/profile"
              className="cursor-pointer items-center gap-3 px-2 py-2"
            >
              <Avatar src={user.image} name={user.name} email={user.email} />
              <div className="flex min-w-0 flex-col">
                {user.name ? (
                  <span className="truncate text-sm font-medium">
                    {user.name}
                  </span>
                ) : null}
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </Link>
          }
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          render={
            <Link href="/profile" className="cursor-pointer">
              <UserIcon />
              Profile
            </Link>
          }
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => {
            // Server action clears the session (cookie + DB row), then we
            // navigate explicitly. We can't rely on `signOut({ redirectTo })`
            // here — a NEXT_REDIRECT thrown by the action is only followed
            // when the call is wrapped in useTransition/useActionState/form
            // action. Direct calls would swallow it and leave the user on
            // the page despite being signed out. router.refresh() drops any
            // cached server-component output that still assumes a session.
            startTransition(async () => {
              await signOutAction();
              router.push("/login");
              router.refresh();
            });
          }}
        >
          <LogOutIcon />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
