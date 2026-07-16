import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
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
          {/* The one action the whole product exists for, and the one place the
              accent earns being spent: it appears once per page, so it stays a
              signal rather than decoration. Ghost made it read as a passive
              link next to Sign in. */}
          <Button
            asChild
            size="sm"
            className="group mr-1 gap-1.5 bg-accent font-medium text-accent-foreground shadow-none hover:bg-accent/85"
          >
            <Link href="/start">
              <PlusIcon
                aria-hidden
                className="size-3.5 transition-transform duration-200 group-hover:rotate-90"
                weight="bold"
              />
              New interview
            </Link>
          </Button>
          {children}
        </nav>
      </div>
    </header>
  );
}
