import { CalendarBlankIcon, TrophyIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { OrgAccountGate } from "@/components/org/org-account-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Measure, shell } from "@/components/ui/page";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DAILY_QUESTION_COUNT,
  type DailyStandingRow,
  getDailyStanding,
  getTodayDailyChallenge,
  getViewerDailyStanding,
} from "@/server/dal/daily";
import { getViewer } from "@/server/dal/session";
import { StartDailyButton } from "./start-daily-button";

export const metadata: Metadata = {
  title: "Daily challenge",
  description:
    "One shared ten-question challenge a day, the same for everyone. Beat the clock and climb today's board. Resets at 00:00 UTC.",
};

export default function DailyPage() {
  return (
    <>
      <Suspense fallback={null}>
        <AuthGate fallback="/daily" />
      </Suspense>
      <OrgAccountGate />
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-14")}>
        <Measure>
          <DataLabel>Daily challenge</DataLabel>
          <h1 className="mt-3 font-display text-display-lg">
            One challenge. Everyone. Today.
          </h1>
          <Prose className="mt-4 text-muted-foreground">
            <p>
              Ten questions on today's topic, ten minutes on the clock — the
              same set for every player, worldwide. Faster times break ties. A
              new challenge is written at 00:00 UTC and the board starts over.
            </p>
          </Prose>

          {/* The session and the day's set are the dynamic hole; the copy above
            stays a static shell. */}
          <Suspense fallback={<DailySkeleton />}>
            <DailyBody />
          </Suspense>
        </Measure>
      </main>
    </>
  );
}

async function DailyBody() {
  const viewer = await getViewer();
  const challenge = await getTodayDailyChallenge();

  if (!challenge) {
    return (
      <section className="mt-10 border p-8 text-center">
        <CalendarBlankIcon
          aria-hidden
          className="mx-auto size-6 text-muted-foreground"
        />
        <p className="mt-3 font-display text-display-md">
          Today's set hasn't been written yet
        </p>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
          Be the first to play and you'll kick off today's challenge. Writing
          the questions takes a moment; then you're straight in.
        </p>
        <div className="mt-6 flex justify-center">
          <StartDailyButton />
        </div>
      </section>
    );
  }

  const [standing, viewerStanding] = await Promise.all([
    getDailyStanding(challenge.id, viewer),
    getViewerDailyStanding(challenge.id, viewer),
  ]);

  return (
    <div className="mt-10 space-y-12">
      <section className="border p-6">
        <div className="flex flex-wrap items-center gap-2">
          <DataLabel>Today's topic</DataLabel>
          <Badge variant="outline" className="text-[0.625rem]">
            {challenge.difficulty.toLowerCase()}
          </Badge>
        </div>
        <p className="mt-2 font-display text-display-md">{challenge.topic}</p>
        <p className="mt-1 font-mono text-muted-foreground text-xs uppercase tracking-[0.12em]">
          {DAILY_QUESTION_COUNT} questions · 10 minutes
        </p>

        <div className="mt-6">
          {viewerStanding ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="text-sm">
                You've played today —{" "}
                <span className="font-display text-lg tabular">
                  #{viewerStanding.rank}
                </span>{" "}
                <span className="text-muted-foreground">
                  at {viewerStanding.score}%
                </span>
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/s/${viewerStanding.sessionId}/result`}>
                  See your result
                </Link>
              </Button>
              <span className="text-muted-foreground text-xs">
                Come back after 00:00 UTC for a new one.
              </span>
            </div>
          ) : (
            <StartDailyButton />
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <DataLabel as="h2">Today's board</DataLabel>
          <span className="text-muted-foreground text-xs">
            {standing.attempts}{" "}
            {standing.attempts === 1 ? "attempt" : "attempts"}
          </span>
        </div>

        {standing.rows.length === 0 ? (
          <div className="mt-6 border p-10 text-center">
            <TrophyIcon
              aria-hidden
              className="mx-auto size-6 text-muted-foreground"
            />
            <p className="mt-3 font-display text-display-md">Nobody yet</p>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
              No one has finished today's challenge. First across the line tops
              the board.
            </p>
          </div>
        ) : (
          <ol className="mt-6 divide-y border-y">
            {standing.rows.map((row) => (
              <StandingRow key={row.sessionId} row={row} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function StandingRow({ row }: { row: DailyStandingRow }) {
  const medal = row.rank <= 3;

  return (
    <li
      className={cn(
        // px-4 keeps the rank and score off the row edge; full-width tint (no
        // -mx bleed) reaches the hairline rules with the content inset from it.
        "flex items-center gap-4 px-4 py-3.5",
        row.isViewer && "bg-accent/10",
      )}
    >
      <span
        className={cn(
          "w-8 shrink-0 text-right font-mono text-sm tabular",
          medal ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {row.rank}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          medal ? "font-display text-lg" : "text-sm",
        )}
      >
        {row.name}
        {row.isViewer ? (
          <span className="ml-2 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
            you
          </span>
        ) : null}
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-muted-foreground text-sm tabular">
        {formatTime(row.timeMs)}
      </span>
      <span className="w-14 shrink-0 text-right font-display text-lg tabular">
        {row.score}%
      </span>
    </li>
  );
}

/** mm:ss from milliseconds. A dash when the timing is missing. */
function formatTime(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function DailySkeleton() {
  return (
    <div className="mt-10 space-y-12" aria-hidden>
      <div className="space-y-3 border p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-52" />
      </div>
      <ol className="divide-y border-y">
        {["a", "b", "c", "d", "e"].map((key) => (
          <li key={key} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-14" />
          </li>
        ))}
      </ol>
    </div>
  );
}
