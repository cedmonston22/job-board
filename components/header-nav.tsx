"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Top-level tab switcher in the header. Client component because the active
// styling depends on the URL, which we read via usePathname(). Keeping it
// separate means <Header> can stay server-side.
//
// "My Jobs" is the dashboard (/), the tab the user lands on by default.
// "Job Search" is the discovered-postings feed scraped daily (/jobs/search).
const TABS = [
  { href: "/", label: "My Jobs" },
  { href: "/jobs/search", label: "Job Search" },
] as const;

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {TABS.map((tab) => {
        // A tab is "active" if the current URL exactly matches its href. We
        // don't startsWith here because that would mark "/" active on every
        // page (since every path starts with "/").
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
