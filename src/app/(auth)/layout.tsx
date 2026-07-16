import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Auth gets a stripped shell rather than SiteHeader: a "New interview" button
 * and a user menu are noise on the two pages whose only job is one form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="mx-auto flex h-14 w-full max-w-5xl shrink-0 items-center justify-between px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-lg tracking-tight">
            InterviewAI
          </span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-accent transition-transform group-hover:scale-125"
          />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-start gap-12 px-6 py-10 lg:grid-cols-[1fr_20rem] lg:gap-16 lg:py-20 xl:grid-cols-[1fr_22rem]">
        {children}
      </main>
    </>
  );
}
