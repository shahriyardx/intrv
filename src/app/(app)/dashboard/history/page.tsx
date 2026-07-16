import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { formatScore } from "@/components/analytics/format";
import {
  StatusBadge,
  sessionHref,
} from "@/components/analytics/session-status";
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
import type { QuestionType } from "@/lib/schemas";
import { getTypeMixBySession, type TypeMix } from "@/server/dal/analytics";
import { listSessions } from "@/server/dal/interview";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "History" };

const PAGE_SIZE = 20;

/** The table has one narrow column for this; the full name doesn't fit. */
const TYPE_ABBREV: Record<QuestionType, string> = {
  MCQ: "MCQ",
  TRUE_FALSE: "T/F",
  SHORT_ANSWER: "SA",
};

function TypeMixCell({ mix }: { mix: TypeMix | undefined }) {
  if (!mix?.length) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="font-mono text-[0.625rem] tabular text-muted-foreground">
      {mix.map((m) => `${m.count} ${TYPE_ABBREV[m.type]}`).join(" · ")}
    </span>
  );
}

export default async function HistoryPage(props: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await props.searchParams;
  const viewer = await getViewer();

  const { items, nextCursor } = await listSessions(viewer, {
    limit: PAGE_SIZE,
    cursor,
  });

  // One batched round trip for the whole page, not one per row.
  const typeMix = await getTypeMixBySession(
    viewer,
    items.map((s) => s.id),
  );

  if (items.length === 0) {
    return cursor ? (
      <EmptyState
        icon={<ClockCounterClockwiseIcon />}
        title="Nothing further back"
        description="You've reached the end of your history."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/history">Back to newest</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<ClockCounterClockwiseIcon />}
        title="No interviews yet"
        description="Every interview you take shows up here with its score and the date you took it."
        action={
          <Button asChild>
            <Link href="/start">Start an interview</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Questions</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Taken</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="max-w-[22ch] truncate font-medium">
                <Link
                  href={sessionHref(session)}
                  className="underline-offset-4 hover:underline"
                >
                  {session.topic}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                {session.difficulty.toLowerCase()}
              </TableCell>
              <TableCell>
                <TypeMixCell mix={typeMix.get(session.id)} />
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {session.status === "GRADED" && session.score !== null ? (
                  `${formatScore(session.score)}%`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={session.status} />
              </TableCell>
              <TableCell className="text-right font-mono text-[0.625rem] tabular text-muted-foreground">
                {format(session.createdAt, "d MMM yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Cursor pagination in the URL: each page is linkable, reloadable, and
          costs no client state. */}
      <div className="flex items-center justify-between gap-4">
        {cursor ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/history">Back to newest</Link>
          </Button>
        ) : (
          <span />
        )}
        {nextCursor ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                `/dashboard/history?cursor=${encodeURIComponent(nextCursor)}` as Route
              }
            >
              Older
            </Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            End of your history
          </span>
        )}
      </div>
    </div>
  );
}
