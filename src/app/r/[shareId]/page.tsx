import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultView } from "@/components/session/result-view";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { DataLabel } from "@/components/ui/prose";
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

export default async function SharedResultPage({ params }: Props) {
  const { shareId } = await params;
  const session = await getSharedSession(shareId);

  if (!session) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8">
          <DataLabel>Shared result</DataLabel>
          <p className="mt-1 font-display text-display-md">{session.topic}</p>
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
      </main>
    </>
  );
}
