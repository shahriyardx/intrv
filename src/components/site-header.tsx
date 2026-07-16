import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-lg tracking-tight">
            InterviewAI
          </span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-accent transition-transform group-hover:scale-125"
          />
        </Link>
        <nav className="flex items-center gap-1">
          {children}
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/start">New interview</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
