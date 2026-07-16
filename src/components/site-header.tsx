import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Presentational and deliberately session-blind — it is rendered from server
 * pages, from loading fallbacks, and from app/error.tsx, which is a client
 * component. Server callers pass <SiteNav /> as children for the account nav;
 * fallbacks and error screens pass nothing and get the static half, which is
 * the honest thing to show when there is no session read to wait on.
 */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-lg tracking-tight">Intrv</span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-accent transition-transform group-hover:scale-125"
          />
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/start">New interview</Link>
          </Button>
          <ThemeToggle />
          {children}
        </nav>
      </div>
    </header>
  );
}
