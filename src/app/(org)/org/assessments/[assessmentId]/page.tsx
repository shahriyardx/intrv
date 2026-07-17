import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatRow, StatTile } from "@/components/analytics/stat-tile";
import {
  QuestionQuality,
  ScoreDistribution,
} from "@/components/org/assessment-analytics";
import { AssessmentControls } from "@/components/org/assessment-controls";
import { formatDuration } from "@/components/org/format";
import { IntegrityChips } from "@/components/org/integrity-chips";
import { InviteLink } from "@/components/org/invite-link";
import { Badge } from "@/components/ui/badge";
import { DataLabel } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { getAssessmentReport } from "@/server/dal/org";
import { getAssessmentAnalytics } from "@/server/dal/org-analytics";
import { getViewer } from "@/server/dal/session";

type Props = { params: Promise<{ assessmentId: string }> };

/** The share of the cohort this candidate outscored. Ungraded attempts have none. */
function percentileLabel(percentile: number | undefined): string {
  return percentile === undefined ? "—" : `beats ${percentile}%`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { assessmentId } = await params;
  const viewer = await getViewer();
  const report = await getAssessmentReport(viewer, assessmentId);
  return { title: report?.assessment.title ?? "Assessment" };
}

export default async function ScreenReportPage({ params }: Props) {
  const { assessmentId } = await params;
  const viewer = await getViewer();

  const [report, analytics] = await Promise.all([
    getAssessmentReport(viewer, assessmentId),
    getAssessmentAnalytics(viewer, assessmentId),
  ]);
  if (!report) notFound();

  const { assessment, candidates, canManage } = report;
  const inviteUrl = `${env.BETTER_AUTH_URL}/i/${assessment.inviteToken}`;

  // A percentile against a cohort of one says "100th" and means nothing.
  const showPercentile = (analytics?.graded ?? 0) >= 5;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* No org/Assessment breadcrumb: the header above already names the org,
              and the nav already says you are in Assessments. */}
          <h2 className="font-display text-display-md">{assessment.title}</h2>
          <p className="mt-1 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
            {assessment.topic} · {assessment.difficulty.toLowerCase()} ·{" "}
            {assessment.questionCount} questions ·{" "}
            {assessment.timeLimitMs
              ? `${assessment.timeLimitMs / 60_000} min`
              : "untimed"}
          </p>
        </div>
        <Badge
          variant={assessment.active ? "secondary" : "outline"}
          className="text-[0.625rem]"
        >
          {assessment.active ? "active" : "closed"}
        </Badge>
      </div>

      <section className="space-y-4 rounded-md border p-5">
        <div className="flex items-baseline justify-between gap-4">
          <DataLabel as="h3">Invite link</DataLabel>
          {!assessment.active ? (
            <span className="text-muted-foreground text-xs">
              Closed — new candidates are turned away.
            </span>
          ) : null}
        </div>
        <InviteLink url={inviteUrl} />
        <p className="text-muted-foreground text-xs">
          Anyone with this link can take the assessment — no account needed.
          Rotate it to revoke every link you've shared.
        </p>
        {canManage ? (
          <div className="border-t pt-4">
            <AssessmentControls
              assessmentId={assessment.id}
              active={assessment.active}
            />
          </div>
        ) : null}
      </section>

      {analytics && analytics.started > 0 ? (
        <>
          <section className="space-y-6">
            <StatRow>
              <StatTile
                label="Attempts"
                value={analytics.started}
                note={`${analytics.submitted} submitted · ${analytics.inProgress} in progress`}
              />
              <StatTile
                label="Abandoned"
                value={analytics.abandoned}
                // Only counts attempts that can no longer plausibly be running,
                // so an in-flight candidate never inflates it.
                note="Started, ran out of time, never submitted"
                tone={
                  analytics.submitted + analytics.abandoned >= 5 &&
                  analytics.abandoned >
                    (analytics.submitted + analytics.abandoned) * 0.3
                    ? "warning"
                    : "default"
                }
              />
              <StatTile
                label="Median time"
                value={formatDuration(analytics.medianDurationMs)}
                note={
                  assessment.timeLimitMs
                    ? `of ${Math.round(assessment.timeLimitMs / 60_000)} min · ${
                        analytics.hitLimit
                      } ran out`
                    : "No time limit"
                }
              />
              <StatTile
                label="Flagged"
                value={analytics.flagged}
                note="Focus loss or paste — indicative, not proof"
                tone={analytics.flagged > 0 ? "warning" : "default"}
              />
            </StatRow>
          </section>

          <ScoreDistribution analytics={analytics} />
          <QuestionQuality questions={analytics.questions} />
        </>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <DataLabel as="h3">Candidates</DataLabel>
          <span className="font-mono text-muted-foreground text-xs tabular">
            {candidates.length}{" "}
            {candidates.length === 1 ? "attempt" : "attempts"}
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 text-center">
            <span
              aria-hidden
              className="mb-4 flex size-10 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-5"
            >
              <UsersThreeIcon weight="duotone" />
            </span>
            <p className="font-display text-display-md">No attempts yet</p>
            <p className="mt-2 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
              Share the invite link above. Every candidate who takes the
              assessment shows up here with their score and anti-cheat signals.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                {showPercentile ? (
                  <TableHead className="text-right">Vs cohort</TableHead>
                ) : null}
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Signals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => {
                const name = c.name ?? "Anonymous";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-40 truncate font-medium">
                      {c.status === "GRADED" ? (
                        <Link
                          href={
                            `/org/assessments/${assessment.id}/c/${c.id}` as Route
                          }
                          className="underline-offset-4 hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-muted-foreground text-xs">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[0.625rem]">
                        {c.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {c.score === null ? "—" : `${Math.round(c.score)}%`}
                    </TableCell>
                    {showPercentile ? (
                      <TableCell className="text-right font-mono text-muted-foreground text-xs tabular">
                        {percentileLabel(analytics?.percentiles.get(c.id))}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right font-mono text-muted-foreground tabular">
                      {formatDuration(c.durationMs)}
                    </TableCell>
                    <TableCell>
                      <IntegrityChips integrity={c.integrity} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
