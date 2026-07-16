import { ArrowRightIcon, TrophyIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { DataLabel, Prose } from "@/components/ui/prose";
import { cn } from "@/lib/utils";
import {
  getLeaderboard,
  getViewerStanding,
  type LeaderboardRow,
} from "@/server/dal/leaderboard";
import { getViewer } from "@/server/dal/session";

/** Stable keys: these rows are placeholders and never reorder. */
const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Who has practised the most, weighted by how hard they made it on themselves.",
};

export default function LeaderboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
      <DataLabel>Global</DataLabel>
      <h1 className="mt-3 font-display text-display-lg">Leaderboard</h1>
      <Prose className="mt-4 text-muted-foreground">
        <p>
          Points are a graded interview's score times how hard it was times how
          long it was. A hard twenty-question interview is worth a lot more than
          a perfect five-question easy one, so this rewards practising rather
          than farming the easy setting.
        </p>
      </Prose>

      <p className="mt-4 font-mono text-[0.6875rem] text-muted-foreground uppercase tracking-[0.12em]">
        score × difficulty (easy ×1 · medium ×1.5 · hard ×2) × questions ÷ 10
      </p>

      {/* Reads the session and the whole board — the shell above stays static. */}
      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </main>
  );
}

async function Board() {
  const viewer = await getViewer();
  const [rows, standing] = await Promise.all([
    getLeaderboard(50),
    getViewerStanding(viewer),
  ]);

  if (rows.length === 0) {
    return (
      <div className="mt-12 border p-10 text-center">
        <TrophyIcon
          aria-hidden
          className="mx-auto size-6 text-muted-foreground"
        />
        <p className="mt-3 font-display text-display-md">Nobody yet</p>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
          Nobody has finished a graded interview while signed in. First one on
          the board wins by default.
        </p>
        <Button asChild className="mt-6">
          <Link href="/start">
            Take the first one
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // Whether the viewer's own row is already on screen, so the standing note
  // below doesn't repeat what they can see.
  const shownInTable =
    viewer.kind === "user" && rows.some((r) => r.userId === viewer.userId);

  return (
    <>
      <ol className="mt-10 divide-y border-y">
        {rows.map((row) => (
          <Row
            key={row.userId}
            row={row}
            isViewer={viewer.kind === "user" && viewer.userId === row.userId}
          />
        ))}
      </ol>

      {standing ? (
        <StandingNote standing={standing} shownInTable={shownInTable} />
      ) : (
        <p className="mt-6 text-muted-foreground text-sm">
          <Link
            href="/sign-in?next=/leaderboard"
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>{" "}
          to be ranked. Interviews taken while signed out aren't on the board —
          there's no name attached to them.
        </p>
      )}
    </>
  );
}

function Row({ row, isViewer }: { row: LeaderboardRow; isViewer: boolean }) {
  const medal = row.rank <= 3;

  return (
    <li
      className={cn(
        "flex items-center gap-4 py-3.5",
        isViewer && "bg-accent/10 px-3 -mx-3",
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

      {/* The top three get weight, not a colour: the rank number is already
          the signal and a gold tint would say nothing to a reader who can't
          see it. */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          medal ? "font-display text-lg" : "text-sm",
        )}
      >
        {row.name}
        {isViewer ? (
          <span className="ml-2 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
            you
          </span>
        ) : null}
      </span>

      <span className="hidden shrink-0 text-muted-foreground text-xs sm:block">
        {row.sessions} {row.sessions === 1 ? "interview" : "interviews"} ·{" "}
        {row.averageScore}% avg
      </span>

      <span className="w-20 shrink-0 text-right font-display text-lg tabular">
        {row.points.toLocaleString("en-GB")}
      </span>
    </li>
  );
}

function StandingNote({
  standing,
  shownInTable,
}: {
  standing: {
    rank: number | null;
    points: number;
    sessions: number;
    optedOut: boolean;
  };
  shownInTable: boolean;
}) {
  if (standing.optedOut) {
    return (
      <p className="mt-6 text-muted-foreground text-sm">
        You're hidden from the leaderboard.{" "}
        <Link
          href="/dashboard/settings"
          className="text-foreground underline underline-offset-4"
        >
          Change that in settings
        </Link>
        .
      </p>
    );
  }

  if (standing.sessions === 0) {
    return (
      <p className="mt-6 text-muted-foreground text-sm">
        You're not on the board yet — finish a graded interview and you will be.
      </p>
    );
  }

  if (shownInTable) return null;

  return (
    <p className="mt-6 border-t pt-4 text-sm">
      <span className="font-mono text-muted-foreground text-xs uppercase tracking-[0.12em]">
        Your standing
      </span>{" "}
      <span className="ml-2 font-display text-lg tabular">
        #{standing.rank}
      </span>
      <span className="ml-2 text-muted-foreground">
        · {standing.points.toLocaleString("en-GB")} points from{" "}
        {standing.sessions}{" "}
        {standing.sessions === 1 ? "interview" : "interviews"}
      </span>
    </p>
  );
}

function BoardSkeleton() {
  return (
    <ol className="mt-10 divide-y border-y" aria-hidden>
      {SKELETON_ROWS.map((key) => (
        <li key={key} className="flex items-center gap-4 py-3.5">
          <span className="h-4 w-8 bg-muted" />
          <span className="h-4 flex-1 bg-muted" />
          <span className="h-4 w-16 bg-muted" />
        </li>
      ))}
    </ol>
  );
}
