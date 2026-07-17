"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/org", label: "Overview" },
  { href: "/org/assessments", label: "Assessments" },
  { href: "/org/members", label: "Members" },
] as const;

export function OrgNav() {
  const pathname = usePathname();

  return (
    // Same construction as AdminNav: the rule sits on the wrapper and the
    // scroller is pulled onto it, so the links' own border-b-2 doesn't overflow
    // it by a pixel and overflow-x-auto doesn't summon a vertical scrollbar.
    <div className="border-b">
      <nav
        className="-mb-px flex gap-1 overflow-x-auto"
        aria-label="Organization"
      >
        {LINKS.map((link) => {
          const active =
            link.href === "/org"
              ? pathname === "/org"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href as Route}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
