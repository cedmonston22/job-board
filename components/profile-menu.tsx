"use client";

import Link from "next/link";
import { ChevronDownIcon, FileTextIcon, LogOutIcon } from "lucide-react";
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
        {/* Header block — read-only summary of who's signed in. */}
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar src={user.image} name={user.name} email={user.email} />
          <div className="flex min-w-0 flex-col">
            {user.name ? (
              <span className="truncate text-sm font-medium">{user.name}</span>
            ) : null}
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          render={
            <Link href="/profile" className="cursor-pointer">
              <FileTextIcon />
              My resume
            </Link>
          }
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            // Server actions are callable from client handlers directly.
            // No transition needed since we just navigate away after.
            void signOutAction();
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
