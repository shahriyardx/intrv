import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResultView } from "@/components/session/result-view";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { DataLabel } from "@/components/ui/prose";
import { getAccessibleSession } from "@/server/dal/interview";
import { getViewer } from "@/server/dal/session";
import { ShareButton } from "./share-button";

export const metadata: Metadata = {
  title: "Your result",
  robots: { index: false },
};

export default async function ResultPage(props: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await props.params;

  const viewer = await getViewer();
  const session = await getAccessibleSession(viewer, sessionId);

  if (!session) notFound();
  // Not graded yet: send them back rather than showing a hollow result page.
  if (session.status !== "GRADED") redirect(`/s/${sessionId}`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <DataLabel>Result</DataLabel>
            <p className="mt-1 font-display text-display-md">{session.topic}</p>
          </div>
          <div className="flex gap-2">
            <ShareButton sessionId={session.id} shareId={session.shareId} />
            <Button asChild variant="outline" size="sm">
              <Link href="/start">New interview</Link>
            </Button>
          </div>
        </div>

        <ResultView session={session} />
      </main>
    </>
  );
}
