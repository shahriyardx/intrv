import {
  CheckCircleIcon,
  CircleDashedIcon,
  FlameIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The daily goal: one graded session, today.
 *
 * The goal is deliberately a single session rather than a configurable target.
 * A goal you can fail by picking the wrong number is a worse goal, and one run
 * is exactly what keeps the streak alive — so the goal and the streak rule are
 * the same rule, and they can never disagree.
 *
 * "Today" is the **UTC** day, matching computeStreaks. A user in UTC+13 will
 * see the day roll over mid-afternoon; that is the same boundary the streak has
 * always used, and one boundary consistently applied beats two.
 */
export function DailyGoal({
  met,
  currentStreak,
  longestStreak,
  className,
}: {
  met: boolean;
  currentStreak: number;
  longestStreak: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border p-5",
        met ? "bg-muted/30" : "bg-background",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {met ? (
          <CheckCircleIcon
            aria-hidden
            weight="fill"
            className="mt-0.5 size-5 shrink-0 text-correct"
          />
        ) : (
          <CircleDashedIcon
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          />
        )}
        <div>
          <p className="font-medium text-sm">
            {met ? "Today's goal is done" : "One interview today"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
            <span className="inline-flex items-center gap-1">
              <FlameIcon aria-hidden weight="fill" className="size-3.5" />
              {currentStreak} day{currentStreak === 1 ? "" : "s"} in a row
            </span>
            <span aria-hidden>·</span>
            <span>best {longestStreak}</span>
            <span aria-hidden>·</span>
            <span>
              {met
                ? "Streak is safe. Anything else today is extra."
                : currentStreak > 0
                  ? "Finish one to keep the streak."
                  : "Finish one to start a streak."}
            </span>
          </p>
        </div>
      </div>

      {met ? null : (
        <Button asChild size="sm">
          <Link href="/start">Start one</Link>
        </Button>
      )}
    </div>
  );
}
