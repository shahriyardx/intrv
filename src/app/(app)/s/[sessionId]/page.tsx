import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Runner } from "@/components/session/runner";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { DataLabel } from "@/components/ui/prose";
import { QUESTION_TYPES, type QuestionType } from "@/lib/schemas";
import { getAccessibleSession } from "@/server/dal/interview";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = {
  title: "Interview",
  robots: { index: false },
};

function parseTypes(raw: string | undefined): QuestionType[] {
  const wanted = (raw ?? "").split(",").filter(Boolean);
  const valid = wanted.filter((t): t is QuestionType =>
    (QUESTION_TYPES as readonly string[]).includes(t),
  );
  return valid.length ? valid : [...QUESTION_TYPES];
}

export default async function SessionPage(props: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ types?: string }>;
}) {
  const { sessionId } = await props.params;
  const { types } = await props.searchParams;

  const viewer = await getViewer();
  const session = await getAccessibleSession(viewer, sessionId);

  if (!session) notFound();
  if (session.status === "GRADED") redirect(`/s/${sessionId}/result`);

  if (session.status === "FAILED") {
    return (
      <>
        <SiteHeader>
          <SiteNav />
        </SiteHeader>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
          <h1 className="font-display text-display-md">
            This session didn't generate
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {session.error ?? "Something went wrong."}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <DataLabel>{session.topic}</DataLabel>
          <Badge variant="outline" className="text-[0.625rem]">
            {session.difficulty.toLowerCase()}
          </Badge>
        </div>

        {/* Suspense keeps the shell static; the runner is the dynamic hole. */}
        <Suspense fallback={<div className="min-h-72" />}>
          <Runner
            sessionId={session.id}
            types={parseTypes(types)}
            expectedCount={session.questionCount}
            expiresAt={
              session.expiresAt ? session.expiresAt.toISOString() : null
            }
            trackIntegrity={session.mode === "SCREEN"}
            adaptive={session.adaptive}
          />
        </Suspense>
      </main>
    </>
  );
}
