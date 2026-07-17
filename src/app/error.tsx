"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { DataLabel } from "@/components/ui/prose";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle that ties this assessment to a server log line.
    // The message is deliberately not rendered — in production it is generic,
    // and in development it is nobody's business but ours.
    console.error("Route error", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <DataLabel>Error</DataLabel>
        <h1 className="mt-3 font-display text-display-lg">That didn't load</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Something broke on our side. Your session is still saved — trying
          again usually gets you back to it.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {/* retry re-fetches the segment; reset would only re-render the same
              failed data. */}
          <Button onClick={() => unstable_retry()}>
            <ArrowClockwiseIcon className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/start">Start an interview</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-10 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            Reference {error.digest}
          </p>
        ) : null}
      </main>
    </>
  );
}
