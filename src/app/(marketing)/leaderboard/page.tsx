import {
  ArrowRightIcon,
  LightningIcon,
  TrophyIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Measure } from "@/components/ui/page";
import { DataLabel, Prose } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getLeaderboard,
  getViewerStanding,
  type LeaderboardRow,
} from "@/server/dal/leaderboard";
import { getViewer } from "@/server/dal/session";
import {
  SEASON_LABEL,
  SEASON_PERIODS,
  type SeasonPeriod,
  seasonSince,
  toSeasonPeriod,
} from "@/server/learning/seasons";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Stable keys: these rows are placeholders and never reorder. */
const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Who has practised the most, weighted by how hard they made it on themselves.",
};

// No <main> here: the marketing layout owns it, and a second one nested inside
// it was invalid.
export default function LeaderboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <DataLabel>Global</DataLabel>
      <h1 className="mt-3 font-display text-display-lg">Leaderboard</h1>
      {/* Only the explanation is capped — the board below it is a table and
          uses the full shell. */}
      <Measure>
        <Prose className="mt-4 text-muted-foreground">
          <p>
            Points are a graded interview's score times how hard it was times
            how long it was. A hard twenty-question interview is worth a lot
            more than a perfect five-question easy one, so this rewards
            practising rather than farming the easy setting.
          </p>
        </Prose>
      </Measure>

      <p className="mt-4 font-mono text-[0.6875rem] text-muted-foreground uppercase tracking-[0.12em]">
        score × difficulty (easy ×1 · medium ×1.5 · hard ×2) × questions ÷ 10
      </p>

      {/* Cross-link to the daily challenge — a different board, refreshed every
          UTC day, that this all-time table complements. */}
      <Link
        href="/daily"
        className="group mt-8 flex items-center gap-4 border p-4 transition-colors hover:border-foreground/40"
      >
        <LightningIcon
          aria-hidden
          weight="fill"
          className="size-5 shrink-0 text-accent"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg">Today's challenge</p>
          <p className="text-muted-foreground text-sm">
            One shared ten-question set, the same for everyone, with its own
            daily board. Fastest correct run wins.
          </p>
        </div>
        <ArrowRightIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </Link>

      {/* Reads searchParams, the session, and the whole board — the shell
          above stays static, this waits on the request. */}
      <Suspense fallback={<BoardSkeleton />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** All time / This month / This week, driven by ?period= and server-rendered. */
function SeasonTabs({ period }: { period: SeasonPeriod }) {
  return (
    <div className="mt-10 flex gap-1 border-b">
      {SEASON_PERIODS.map((p) => {
        const active = p === period;
        const href = p === "all" ? "/leaderboard" : `/leaderboard?period=${p}`;
        return (
          <Link
            key={p}
            href={href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors",
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {SEASON_LABEL[p]}
          </Link>
        );
      })}
    </div>
  );
}

async function Board({ searchParams }: { searchParams: SearchParams }) {
  const period = toSeasonPeriod((await searchParams).period);
  const since = seasonSince(period, new Date());

  const viewer = await getViewer();
  const [rows, standing] = await Promise.all([
    getLeaderboard(50, since),
    getViewerStanding(viewer, since),
  ]);

  if (rows.length === 0) {
    return (
      <>
        <SeasonTabs period={period} />
        <div className="mt-10 border p-10 text-center">
          <TrophyIcon
            aria-hidden
            className="mx-auto size-6 text-muted-foreground"
          />
          <p className="mt-3 font-display text-display-md">Nobody yet</p>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
            {period === "all"
              ? "Nobody has finished a graded interview while signed in. First one on the board wins by default."
              : `No graded interviews ${period === "week" ? "this week" : "this month"} yet. Take one and you're on the board.`}
          </p>
          <Button asChild className="mt-6">
            <Link href="/start">
              Take the first one
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </>
    );
  }

  // Whether the viewer's own row is already on screen, so the standing note
  // below doesn't repeat what they can see.
  const shownInTable =
    viewer.kind === "user" && rows.some((r) => r.userId === viewer.userId);

  return (
    <>
      <SeasonTabs period={period} />
      <Table className="mt-6">
        <TableHeader>
          <HeadRow />
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <Row
              key={row.userId}
              row={row}
              isViewer={viewer.kind === "user" && viewer.userId === row.userId}
            />
          ))}
        </TableBody>
      </Table>

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

/** Column labels in the house's mono-uppercase style, not the shadcn default. */
const LABEL =
  "font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground";

function HeadRow() {
  return (
    <TableRow className="hover:bg-transparent">
      <TableHead className={cn(LABEL, "w-12 text-right")}>#</TableHead>
      <TableHead className={LABEL}>Player</TableHead>
      <TableHead className={cn(LABEL, "hidden text-right sm:table-cell")}>
        Activity
      </TableHead>
      <TableHead className={cn(LABEL, "pr-4 text-right")}>Points</TableHead>
    </TableRow>
  );
}

function Row({ row, isViewer }: { row: LeaderboardRow; isViewer: boolean }) {
  const medal = row.rank <= 3;

  return (
    // A tr background fills the row and cannot escape the table, so the viewer
    // tint stays within the rules by construction — no bleed to guard against.
    <TableRow className={cn(isViewer && "bg-accent/10 hover:bg-accent/10")}>
      <TableCell
        className={cn(
          "w-12 py-3.5 text-right font-mono text-sm tabular",
          medal ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {row.rank}
      </TableCell>

      {/* The top three get weight, not a colour: the rank number is already the
          signal and a gold tint would say nothing to a reader who can't see it. */}
      <TableCell
        className={cn(
          "max-w-0 truncate py-3.5",
          medal ? "font-display text-lg" : "text-sm",
        )}
      >
        {row.name}
        {isViewer ? <span className={cn(LABEL, "ml-2")}>you</span> : null}
      </TableCell>

      <TableCell className="hidden py-3.5 text-right text-muted-foreground text-xs sm:table-cell">
        {row.sessions} {row.sessions === 1 ? "interview" : "interviews"} ·{" "}
        {row.averageScore}% avg
      </TableCell>

      <TableCell className="py-3.5 pr-4 text-right font-display text-lg tabular">
        {row.points.toLocaleString("en-GB")}
      </TableCell>
    </TableRow>
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
    <Table className="mt-10" aria-hidden>
      <TableHeader>
        <HeadRow />
      </TableHeader>
      <TableBody>
        {SKELETON_ROWS.map((key) => (
          <TableRow key={key} className="hover:bg-transparent">
            <TableCell className="w-12 py-3.5">
              <span className="ml-auto block h-4 w-4 bg-muted" />
            </TableCell>
            <TableCell className="py-3.5">
              <span className="block h-4 w-40 bg-muted" />
            </TableCell>
            <TableCell className="hidden py-3.5 sm:table-cell">
              <span className="ml-auto block h-4 w-28 bg-muted" />
            </TableCell>
            <TableCell className="py-3.5 pr-4">
              <span className="ml-auto block h-4 w-10 bg-muted" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
