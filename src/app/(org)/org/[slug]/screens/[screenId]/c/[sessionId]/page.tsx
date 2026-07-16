import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration } from "@/components/org/format";
import { IntegrityChips } from "@/components/org/integrity-chips";
import { ResultView } from "@/components/session/result-view";
import { DataLabel } from "@/components/ui/prose";
import { getCandidateDetail } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

type Props = {
  params: Promise<{ slug: string; screenId: string; sessionId: string }>;
};

export const metadata: Metadata = { title: "Candidate" };

export default async function CandidateDetailPage({ params }: Props) {
  const { slug, screenId, sessionId } = await params;
  const viewer = await getViewer();

  const result = await getCandidateDetail(viewer, sessionId);
  if (!result) notFound();

  const { detail, candidate, screen } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <DataLabel>
          <Link
            href={`/org/${slug}/screens/${screenId}` as Route}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {screen.title}
          </Link>{" "}
          / Candidate
        </DataLabel>
        <h2 className="mt-2 font-display text-display-md">
          {candidate.name ?? "Anonymous candidate"}
        </h2>
        {candidate.email ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {candidate.email}
          </p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-t pt-6 sm:grid-cols-3">
          <Stat label="Score">
            {candidate.score === null ? "—" : `${Math.round(candidate.score)}%`}
          </Stat>
          <Stat label="Duration">{formatDuration(candidate.durationMs)}</Stat>
          <Stat label="Status">{candidate.status.toLowerCase()}</Stat>
          <div className="col-span-2 sm:col-span-3">
            <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              Signals
            </dt>
            <dd className="mt-1.5">
              <IntegrityChips integrity={candidate.integrity} />
            </dd>
          </div>
        </dl>
      </div>

      <ResultView session={detail} />
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
    <div>
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg tabular capitalize">{children}</dd>
    </div>
  );
}
