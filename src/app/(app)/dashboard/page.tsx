import {
  ArrowRightIcon,
  ChartLineUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { formatScore } from "@/components/analytics/format";
import {
  StatusBadge,
  sessionHref,
} from "@/components/analytics/session-status";
import { StatTile } from "@/components/analytics/stat-tile";
import { WeakConcepts } from "@/components/analytics/weak-concepts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataLabel, Prose } from "@/components/ui/prose";
import { getOverviewStats, getWeakConcepts } from "@/server/dal/analytics";
import { listSessions } from "@/server/dal/interview";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const viewer = await getViewer();

  const [stats, weakConcepts, recent] = await Promise.all([
    getOverviewStats(viewer),
    getWeakConcepts(viewer, { limit: 5 }),
    listSessions(viewer, { limit: 5 }),
  ]);

  if (stats.totalSessions === 0) {
    return (
      <EmptyState
        icon={<ChartLineUpIcon />}
        title="Nothing here yet"
        description="Take an interview and this becomes your record: every score, every question you missed, and what to study next. Nothing to show until then."
        action={
          <Button asChild>
            <Link href="/start">Start an interview</Link>
          </Button>
        }
      />
    );
  }

  const gradedNone = stats.gradedSessions === 0;

  return (
    <div className="space-y-14">
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Interviews taken"
          value={stats.totalSessions}
          note={
            stats.gradedSessions === stats.totalSessions
              ? "All graded"
              : `${stats.gradedSessions} graded`
          }
        />
        <StatTile
          label="Average score"
          // An average over nothing is not 0 — it doesn't exist yet.
          value={
            stats.averageScore === null
              ? "—"
              : `${formatScore(stats.averageScore)}%`
          }
          note={
            gradedNone
              ? "No graded sessions yet"
              : `Across ${stats.gradedSessions} graded ${
                  stats.gradedSessions === 1 ? "session" : "sessions"
                }`
          }
        />
        <StatTile
          label="Questions answered"
          value={stats.questionsAnswered}
          note={
            stats.bestScore === null
              ? undefined
              : `Best score ${formatScore(stats.bestScore)}%`
          }
        />
        <StatTile
          label="Best topic"
          value={
            stats.bestTopic ? (
              <span className="text-display-md">{stats.bestTopic.topic}</span>
            ) : (
              "—"
            )
          }
          note={
            stats.bestTopic
              ? `${formatScore(stats.bestTopic.averageScore)}% over ${
                  stats.bestTopic.attempts
                } ${stats.bestTopic.attempts === 1 ? "attempt" : "attempts"}`
              : "Grade a session to see this"
          }
        />
      </section>

      <div className="grid gap-14 lg:grid-cols-2">
        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <DataLabel>What to study next</DataLabel>
            {weakConcepts.length > 0 ? (
              <Link
                href="/dashboard/mistakes"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Review mistakes
              </Link>
            ) : null}
          </div>

          {weakConcepts.length > 0 ? (
            <WeakConcepts concepts={weakConcepts} />
          ) : (
            <Prose className="text-sm text-muted-foreground">
              <p>
                {gradedNone
                  ? "Nothing graded yet, so there's nothing to diagnose."
                  : "No concept has tripped you up more than once yet. Take a few more interviews and the pattern will show up here."}
              </p>
            </Prose>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <DataLabel>Recent</DataLabel>
            <Link
              href="/dashboard/history"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              All history
            </Link>
          </div>

          <ul className="divide-y border-t">
            {recent.items.map((session) => (
              <li key={session.id}>
                <Link
                  href={sessionHref(session)}
                  className="group flex items-center gap-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {session.topic}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {session.difficulty.toLowerCase()} ·{" "}
                      {formatDistanceToNow(session.createdAt, {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                  {session.status === "GRADED" && session.score !== null ? (
                    <span className="font-mono text-sm tabular">
                      {formatScore(session.score)}%
                    </span>
                  ) : (
                    <StatusBadge status={session.status} />
                  )}
                  <ArrowRightIcon
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>

          <Button asChild variant="outline" size="sm">
            <Link href="/start">New interview</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
