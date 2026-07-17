import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChallengeFriendButton } from "@/components/challenge/challenge-friend-button";
import { RematchBanner } from "@/components/challenge/rematch-banner";
import { AssessmentSubmitted } from "@/components/org/assessment-submitted";
import { ResultView } from "@/components/session/result-view";
import { PdfButton } from "@/components/share/pdf-button";
import { PrintHeader } from "@/components/share/print-header";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Measure, shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { cn } from "@/lib/utils";
import { getAccessibleSession } from "@/server/dal/interview";
import { getAssessmentGate } from "@/server/dal/org";
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

  // Screening attempts belong to the org's process: the candidate gets a
  // receipt, only the assessment's org members see the graded result.
  if (session.mode === "ASSESSMENT") {
    const gate = await getAssessmentGate(viewer, sessionId);
    if (!gate.viewable) {
      return (
        <>
          <SiteHeader>
            <SiteNav />
          </SiteHeader>
          <main className={cn(shell, "flex-1 py-10")}>
            <Measure>
              <AssessmentSubmitted orgName={gate.orgName} />
            </Measure>
          </main>
        </>
      );
    }
  }

  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-10")}>
        <Measure>
          <PrintHeader session={session} />
          <RematchBanner session={session} />
          <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <DataLabel>Result</DataLabel>
              <p className="mt-1 font-display text-display-md">
                {session.topic}
              </p>
            </div>
            <div className="flex gap-2">
              <ShareButton sessionId={session.id} shareId={session.shareId} />
              <ChallengeFriendButton
                sessionId={session.id}
                shareId={session.shareId}
              />
              <PdfButton />
              <Button asChild variant="outline" size="sm">
                <Link href="/start">New interview</Link>
              </Button>
            </div>
          </div>

          <ResultView session={session} />
        </Measure>
      </main>
    </>
  );
}
