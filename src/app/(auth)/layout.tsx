import Link from "next/link";
import { shell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

/**
 * Auth gets a stripped shell rather than SiteHeader: a "New interview" button
 * and a user menu are noise on the two pages whose only job is one form. Same
 * width as the real header, though, so the wordmark doesn't shift sideways when
 * you arrive here from a page that has one.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header
        className={cn(shell, "flex h-14 shrink-0 items-center justify-between")}
      >
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-lg tracking-tight">Intrv</span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-accent transition-transform group-hover:scale-125"
          />
        </Link>
      </header>
      {/* The form column is capped by the grid track, so the pair stays a
          readable measure inside the wider shell. */}
      <main
        className={cn(
          shell,
          "grid flex-1 grid-cols-1 items-start gap-12 py-10 lg:grid-cols-[1fr_22rem] lg:gap-16 lg:py-20 xl:grid-cols-[1fr_24rem]",
        )}
      >
        {children}
      </main>
    </>
  );
}
