import { FileTextIcon } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCount,
  formatDateTime,
  formatPercent,
} from "@/components/admin/format";
import { SectionHeading } from "@/components/admin/section-heading";
import { StatRow, StatTile } from "@/components/analytics/stat-tile";
import { AssessmentsTable } from "@/components/org/assessments-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveOrg, listAssessments } from "@/server/dal/org";
import {
  getOrgOverview,
  listRecentCandidates,
} from "@/server/dal/org-analytics";
import { getViewer } from "@/server/dal/session";

/**
 * The organization dashboard — one org per account, so there is no list and no
 * slug in the URL: the active org comes from the session. A personal account
 * that reaches here isn't an org account and is sent back to their dashboard.
 */
export default async function OrgDashboardPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/dashboard");

  const viewer = await getViewer();
  const [assessments, overview, recent] = await Promise.all([
    listAssessments(viewer, org.id),
    getOrgOverview(viewer, org.id),
    listRecentCandidates(viewer, org.id),
  ]);

  const canManage = org.role === "owner" || org.role === "admin";

  if (assessments.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<FileTextIcon weight="duotone" />}
          title="No assessments yet"
          description="An assessment is a frozen interview you send to candidates. Generate one and share its link — every candidate answers the identical set, so their scores are comparable."
          action={
            canManage ? (
              <Button asChild>
                <Link href={"/org/assessments/new" as Route}>
                  Create an assessment
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const abandonHigh =
    overview !== null &&
    overview.completionRate !== null &&
    overview.completionRate < 0.7;

  return (
    <div className="space-y-12">
      {overview ? (
        <section className="space-y-6">
          <SectionHeading label="All time" title="Where things stand" />
          <StatRow>
            <StatTile
              label="Screens"
              value={formatCount(overview.activeScreens)}
              note={`${formatCount(overview.totalScreens)} total · ${formatCount(
                overview.totalScreens - overview.activeScreens,
              )} closed`}
            />
            <StatTile
              label="Candidates"
              value={formatCount(overview.candidates)}
              note={`${formatCount(overview.candidates7d)} in the last 7 days`}
            />
            <StatTile
              label="Completion"
              value={formatPercent(overview.completionRate)}
              // The denominator is the honest part: an attempt that started ten
              // minutes ago is neither finished nor abandoned yet.
              note={
                overview.completionRate === null
                  ? "No finished attempts yet"
                  : `${formatCount(overview.abandoned)} abandoned · in-progress excluded`
              }
              tone={abandonHigh ? "warning" : "default"}
            />
            <StatTile
              label="Median score"
              value={
                overview.medianScore === null
                  ? "—"
                  : `${Math.round(overview.medianScore)}%`
              }
              note="Across graded attempts"
            />
          </StatRow>
        </section>
      ) : null}

      <section className="space-y-6">
        <SectionHeading label="Activity" title="Latest candidates">
          <Button asChild variant="outline" size="sm">
            <Link href={"/org/assessments" as Route}>All assessments</Link>
          </Button>
        </SectionHeading>

        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has taken an assessment yet. Share an assessment's invite
            link to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((row) => (
                <TableRow key={row.sessionId}>
                  <TableCell className="max-w-44 truncate">
                    <Link
                      href={
                        `/org/assessments/${row.assessmentId}/c/${row.sessionId}` as Route
                      }
                      className="underline-offset-4 hover:underline"
                    >
                      {row.name ?? "Unnamed"}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {row.assessmentTitle}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-[0.625rem] lowercase"
                    >
                      {row.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {row.score === null ? "—" : `${Math.round(row.score)}%`}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDateTime(row.at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-6">
        <SectionHeading label="Screens" title="Your assessments" />
        <AssessmentsTable assessments={assessments.slice(0, 5)} />
      </section>
    </div>
  );
}
