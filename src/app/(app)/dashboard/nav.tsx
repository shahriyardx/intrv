"use client";

import type { Route } from "next";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Client only because the active route is a client fact: a server layout is not
 * re-rendered on navigation between its own children, so it cannot know which
 * one is showing. useSelectedLayoutSegment returns null on the index route.
 */
const LINKS: { segment: string | null; href: Route; label: string }[] = [
  { segment: null, href: "/dashboard", label: "Overview" },
  { segment: "history", href: "/dashboard/history", label: "History" },
  { segment: "mistakes", href: "/dashboard/mistakes", label: "Mistakes" },
  { segment: "analytics", href: "/dashboard/analytics", label: "Analytics" },
  { segment: "settings", href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="no-print -mb-px flex gap-1 overflow-x-auto border-b">
      {LINKS.map((link) => {
        const active = link.segment === segment;

        return (
          <Link
            key={link.href}
            href={link.href}
            // aria-current is the accessible half of "active"; the underline is
            // the visible half. Neither stands alone.
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
