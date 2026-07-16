"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/ai-usage", label: "AI usage" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    // The rule is on the wrapper and the scroller is pulled onto it. Putting the
    // rule on the scroller alongside the links' own border-b-2 leaves them
    // overflowing it by 1px, and overflow-x-auto coerces the other axis to auto
    // — which draws a stray vertical scrollbar over the page.
    <div className="border-b">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Admin">
        {LINKS.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
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
