import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResultView } from "@/components/session/result-view";
import { PdfButton } from "@/components/share/pdf-button";
import { PrintHeader } from "@/components/share/print-header";
import { ScoreCard } from "@/components/share/score-card";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSharedSession } from "@/server/dal/share";

type Props = { params: Promise<{ shareId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const session = await getSharedSession(shareId);

  if (!session) return { title: "Result not found" };

  return {
    title: `${session.topic} — ${session.score ?? 0}%`,
    description: `A ${session.difficulty.toLowerCase()} interview on ${session.topic}, scored ${session.score ?? 0}%.`,
    // A shared result is a personal artefact; a link is not an invitation to
    // index it.
    robots: { index: false, follow: false },
  };
}

/**
 * The shell is everything that does not depend on the share id, and the page
 * itself is synchronous so that it stays that way. `params` is runtime data
 * under cacheComponents: awaiting it here — never mind the lookup it feeds —
 * would leave the route with no prerenderable shell at all, which the build
 * reports as a blocking-route error. So the promise goes down into the
 * boundary and is awaited there.
 */
export default function SharedResultPage({ params }: Props) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Suspense fallback={<SharedResultSkeleton />}>
          <SharedResult params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function SharedResult({ params }: Props) {
  const { shareId } = await params;
  const session = await getSharedSession(shareId);

  if (!session) notFound();

  return (
    <>
      <PrintHeader session={session} />

      <div className="no-print mb-8 flex items-center justify-end">
        <PdfButton />
      </div>

      <div className="mb-12">
        <ScoreCard session={session} />
      </div>

      <ResultView session={session} />

      <div className="no-print mt-14 rounded-md border p-6 text-center">
        <p className="font-display text-display-md">Think you'd do better?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate an interview on any topic. No account needed.
        </p>
        <Button asChild className="mt-5">
          <Link href="/start">Try {session.topic}</Link>
        </Button>
      </div>
    </>
  );
}

function SharedResultSkeleton() {
  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-end">
        <div className="space-y-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-[4.5rem] w-36" />
        </div>
        <div className="space-y-2 sm:pb-2">
          <Skeleton className="h-4 w-full max-w-[34ch]" />
          <Skeleton className="h-4 w-3/5 max-w-[24ch]" />
        </div>
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
