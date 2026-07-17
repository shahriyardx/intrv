"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import "./globals.css";
import { shell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

/**
 * Replaces the root layout, so everything it set up is gone: no font variables,
 * no theme provider, no header. This assessment therefore assumes nothing loads —
 * system faces stand in for the webfonts, and it renders light-only because the
 * `.dark` class is applied by a provider that no longer exists.
 */
const FALLBACK_FONTS = {
  "--font-geist-sans": "ui-sans-serif, system-ui, sans-serif",
  "--font-jetbrains-mono": "ui-monospace, SFMono-Regular, monospace",
  "--font-newsreader": "Newsreader, Georgia, 'Times New Roman', serif",
} as CSSProperties;

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Global error", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased" style={FALLBACK_FONTS}>
      <body className="flex min-h-full flex-col bg-background text-foreground font-sans">
        {/* metadata exports don't work in an error boundary; React renders the
            title tag instead. */}
        <title>Something went wrong · Intrv</title>
        <main
          className={cn(
            shell,
            "flex flex-1 flex-col items-center justify-center py-24 text-center",
          )}
        >
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
            Error
          </span>
          <h1 className="mt-3 font-display text-display-lg">Intrv crashed</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Not your fault, and nothing you answered was lost. Reload and you
            should land back where you were.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex h-9 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex h-9 items-center rounded-sm border px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Go home
            </a>
          </div>

          {error.digest ? (
            <p className="mt-10 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
