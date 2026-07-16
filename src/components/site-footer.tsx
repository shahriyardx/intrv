import type { Route } from "next";
import Link from "next/link";

/**
 * The theme toggle deliberately lives only in SiteHeader. Two toggles on one
 * page are two controls for one piece of state — the second one is a bug
 * waiting to look like a bug.
 */
const GROUPS: {
  title: string;
  links: { href: Route; label: string }[];
}[] = [
  {
    title: "Product",
    links: [
      { href: "/start", label: "Start an interview" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print border-t">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-8">
          <div className="max-w-xs">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="font-display text-lg tracking-tight">Intrv</span>
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-accent transition-transform group-hover:scale-125"
              />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Practice interviews on any topic, graded with feedback that tells
              you what to study next.
            </p>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.title} aria-labelledby={`footer-${group.title}`}>
              <h2
                id={`footer-${group.title}`}
                className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            © 2026 Intrv
          </p>
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            Free · No account required
          </p>
        </div>
      </div>
    </footer>
  );
}
