import { SwordIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AcceptChallengeButton } from "@/components/challenge/accept-challenge-button";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Measure, shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getChallengeSource } from "@/server/dal/challenge";

type Props = { params: Promise<{ shareId: string }> };

export const metadata: Metadata = {
  title: "You've been challenged",
  // An invite link is not something a search engine should hold a copy of.
  robots: { index: false, follow: false },
};

/**
 * The shell holds nothing that depends on the share id, and the page stays
 * synchronous so it can be prerendered — `params` is runtime data under
 * cacheComponents, so the lookup it feeds is pushed into the Suspense boundary.
 * Same shape as the shared-result page.
 */
export default function ChallengePage({ params }: Props) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-16")}>
        <Measure>
          <Suspense fallback={<ChallengeSkeleton />}>
            <ChallengeInvite params={params} />
          </Suspense>
        </Measure>
      </main>
    </>
  );
}

async function ChallengeInvite({ params }: Props) {
  const { shareId } = await params;
  const source = await getChallengeSource(shareId);

  if (!source) notFound();

  const who = source.challengerName ?? "Someone";
  const minutes = source.timeLimitMs
    ? Math.round(source.timeLimitMs / 60_000)
    : null;

  return (
    <div className="text-center">
      <SwordIcon
        aria-hidden
        weight="fill"
        className="mx-auto size-8 text-accent"
      />
      <DataLabel className="mt-6 block">A challenge for you</DataLabel>
      <h1 className="mt-3 font-display text-display-lg text-balance">
        {who} scored {source.score}% on {source.topic}
      </h1>
      <p className="mt-4 text-muted-foreground">
        Take the exact same questions and see if you can beat that score.
      </p>

      <dl className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Stat label="Topic">{source.topic}</Stat>
        <Stat label="Difficulty">
          <Badge variant="outline" className="text-[0.625rem]">
            {source.difficulty.toLowerCase()}
          </Badge>
        </Stat>
        <Stat label="Questions">{source.questionCount}</Stat>
        <Stat label="Time limit">{minutes ? `${minutes} min` : "Untimed"}</Stat>
      </dl>

      <div className="mt-10 flex justify-center">
        <AcceptChallengeButton shareId={shareId} />
      </div>
      <p className="mt-4 text-muted-foreground text-xs">
        You'll need an account to take it — the result goes in your history.
      </p>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <DataLabel as="dt">{label}</DataLabel>
      <dd className="font-display text-lg tabular">{children}</dd>
    </div>
  );
}

function ChallengeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" aria-hidden>
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="mt-4 h-3 w-32" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-8 h-12 w-52" />
    </div>
  );
}
