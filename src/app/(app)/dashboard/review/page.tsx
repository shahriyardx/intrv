import {
  CheckCircleIcon,
  ClockCountdownIcon,
} from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { RetireButton } from "@/components/analytics/retire-button";
import { ReviewNowButton } from "@/components/analytics/review-now-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataLabel } from "@/components/ui/prose";
import { getReviewQueue, type ReviewItemRow } from "@/server/dal/learning";
import { getViewer } from "@/server/dal/session";
import { ladderLabel } from "@/server/learning/scheduling";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  const viewer = await getViewer();
  const queue = await getReviewQueue(viewer);

  const nothingTracked =
    queue.dueCount === 0 &&
    queue.upcoming.length === 0 &&
    queue.retiredCount === 0;

  if (nothingTracked) {
    return (
      <EmptyState
        icon={<ClockCountdownIcon />}
        title="Nothing to review yet"
        description="When you miss a question, its concept comes back here on a spaced schedule — a day later, then three, then a week. Take an interview and the ones you miss start showing up."
        action={
          <Button asChild>
            <Link href="/start">Start an interview</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <DataLabel as="h2">Due now</DataLabel>
            <p className="mt-2 font-display text-display-lg tabular">
              {queue.dueCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {queue.dueCount > 0 ? <ReviewNowButton /> : null}
            {queue.dueCount + queue.upcoming.length > 0 ? (
              <RetireButton
                all
                variant="outline"
                label="Clear queue"
                confirmLabel="Clear everything?"
              />
            ) : null}
          </div>
        </div>

        {queue.due.length > 0 ? (
          <ReviewList items={queue.due} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing is due right now. The concepts you're tracking come back on
            their own schedule — check the upcoming list below.
          </p>
        )}
      </section>

      {queue.upcoming.length > 0 ? (
        <section className="space-y-5">
          <DataLabel as="h2">Coming up this week</DataLabel>
          <ReviewList items={queue.upcoming} showDue />
        </section>
      ) : null}

      {queue.retiredCount > 0 ? (
        <section className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
          <CheckCircleIcon className="size-4 shrink-0" aria-hidden />
          <span>
            {queue.retiredCount} concept{queue.retiredCount === 1 ? "" : "s"}{" "}
            mastered and retired from the queue.
          </span>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The stage is shown as its ladder position (1d / 3d / 7d) rather than a raw
 * integer — that's the interval a correct answer earned, which is what the
 * number means to a student.
 */
function ReviewList({
  items,
  showDue = false,
}: {
  items: ReviewItemRow[];
  showDue?: boolean;
}) {
  return (
    <ul className="divide-y border-t">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono">{item.concept}</span>
            <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              {item.topic} · {item.difficulty.toLowerCase()}
              {item.lapses > 0
                ? ` · ${item.lapses} lapse${item.lapses === 1 ? "" : "s"}`
                : ""}
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
            {ladderLabel(item.stage)}
          </span>
          {showDue ? (
            <span className="w-24 shrink-0 text-right font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              {formatDistanceToNow(item.dueAt, { addSuffix: true })}
            </span>
          ) : null}
          <RetireButton itemId={item.id} label="I've got this" />
        </li>
      ))}
    </ul>
  );
}
