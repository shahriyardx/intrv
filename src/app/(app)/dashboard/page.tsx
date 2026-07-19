import {
  ArrowRightIcon,
  ChartLineUpIcon,
  ClockCountdownIcon,
  FlameIcon,
} from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityHeatmap } from "@/components/analytics/activity-heatmap";
import { formatScore } from "@/components/analytics/format";
import { ReviewNowButton } from "@/components/analytics/review-now-button";
import {
  StatusBadge,
  sessionHref,
} from "@/components/analytics/session-status";
import { StatTile } from "@/components/analytics/stat-tile";
import { WeakConcepts } from "@/components/analytics/weak-concepts";
import { DailyGoal } from "@/components/game/daily-goal";
import { LevelBar } from "@/components/game/level-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataLabel, Prose } from "@/components/ui/prose";
import { getOverviewStats, getWeakConcepts } from "@/server/dal/analytics";
import { listSessions } from "@/server/dal/interview";
import {
  getActivityCalendar,
  getDueReviewCount,
  getMomentum,
  getProgression,
} from "@/server/dal/learning";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const viewer = await getViewer();

  const [
    stats,
    weakConcepts,
    recent,
    momentum,
    dueReviews,
    calendar,
    progression,
  ] = await Promise.all([
    getOverviewStats(viewer),
    getWeakConcepts(viewer, { limit: 5 }),
    listSessions(viewer, { limit: 5 }),
    getMomentum(viewer),
    getDueReviewCount(viewer),
    getActivityCalendar(viewer),
    getProgression(viewer),
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
      <DailyGoal
        met={progression.goalMetToday}
        currentStreak={progression.currentStreak}
        longestStreak={progression.longestStreak}
      />

      <section className="grid gap-x-8 gap-y-6 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <DataLabel as="h2">Level</DataLabel>
          <LevelBar level={progression.level} />
        </div>
        {/* Interviews taken sits beside the level rather than badges: the
            earned badges are already on the shelf under the name above, so a
            second copy here was just duplication. */}
        <div className="space-y-3">
          <DataLabel as="h2">Interviews taken</DataLabel>
          <p className="font-display text-display-lg tabular leading-none">
            {stats.totalSessions}
          </p>
          <p className="text-muted-foreground text-xs">
            {stats.gradedSessions === stats.totalSessions
              ? "All graded"
              : `${stats.gradedSessions} graded`}
          </p>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Current streak"
          value={
            <span className="inline-flex items-center gap-1.5">
              <FlameIcon
                aria-hidden
                weight="fill"
                className="size-5 text-muted-foreground"
              />
              {momentum.currentStreak}
            </span>
          }
          note={
            momentum.currentStreak === 0
              ? "Grade a session today to start one"
              : `${momentum.currentStreak === 1 ? "day" : "days"} in a row · best ${momentum.longestStreak}`
          }
        />
        <StatTile
          label="XP"
          value={momentum.xp.toLocaleString()}
          note="Earned across every graded interview"
        />
        <StatTile
          label="Due for review"
          value={dueReviews}
          note={
            dueReviews === 0
              ? "Nothing due — you're caught up"
              : `${dueReviews === 1 ? "concept" : "concepts"} waiting`
          }
        />
      </section>

      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <DataLabel as="h2">Activity</DataLabel>
          <span className="font-mono text-muted-foreground text-xs">
            {calendar.total} graded in the last year · {calendar.activeDays}{" "}
            {calendar.activeDays === 1 ? "day" : "days"} active
          </span>
        </div>
        <ActivityHeatmap calendar={calendar} />
      </section>

      {dueReviews > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-4 border border-border bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <ClockCountdownIcon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            />
            <div>
              <p className="text-sm font-medium">
                {dueReviews} concept{dueReviews === 1 ? "" : "s"} due for review
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Fresh questions on the concepts you've missed, on a spaced
                schedule.{" "}
                <Link
                  href="/dashboard/review"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  See the queue
                </Link>
              </p>
            </div>
          </div>
          <ReviewNowButton size="sm" />
        </section>
      ) : null}

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
