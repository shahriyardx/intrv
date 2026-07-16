import { CompassIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { formatPercent } from "@/components/analytics/format";
import { ReviewNowButton } from "@/components/analytics/review-now-button";
import { StartPlannedButton } from "@/components/analytics/start-planned-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataLabel } from "@/components/ui/prose";
import { getMastery, getReviewQueue } from "@/server/dal/learning";
import { getViewer } from "@/server/dal/session";
import { suggestDifficulty } from "@/server/learning/plan";

export const metadata: Metadata = { title: "Plan" };

/** Enough attempts that a correct-rate means something, not one unlucky quiz. */
const MIN_ATTEMPTS = 3;
const MAX_SUGGESTIONS = 5;

export default async function PlanPage() {
  const viewer = await getViewer();
  const [queue, mastery] = await Promise.all([
    getReviewQueue(viewer),
    getMastery(viewer),
  ]);

  // Weakest topics with enough history to trust, hardest weaknesses first.
  const suggestions = mastery.topics
    .filter((topic) => topic.attempts >= MIN_ATTEMPTS)
    .slice(0, MAX_SUGGESTIONS)
    .map((topic) => ({
      topic: topic.topic,
      attempts: topic.attempts,
      correctRate: topic.correctRate,
      difficulty: suggestDifficulty(topic.difficulty, topic.correctRate),
    }));

  const nothingToPlan = queue.dueCount === 0 && suggestions.length === 0;

  if (nothingToPlan) {
    return (
      <EmptyState
        icon={<CompassIcon />}
        title="No plan yet"
        description="Your learning path is built from what you've practised and what you keep missing. Take a few interviews and this becomes a short list of exactly what to do next."
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
        <DataLabel as="h2">Today</DataLabel>
        {queue.dueCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <p className="text-sm">
              <span className="font-display text-display-md tabular">
                {queue.dueCount}
              </span>{" "}
              <span className="text-muted-foreground">
                concept{queue.dueCount === 1 ? "" : "s"} due for review.
              </span>
            </p>
            <ReviewNowButton />
          </div>
        ) : (
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Nothing due for review today. Keep practising and missed concepts
            will surface here on their schedule.
          </p>
        )}
      </section>

      {suggestions.length > 0 ? (
        <section className="space-y-5">
          <div>
            <DataLabel as="h2">This week</DataLabel>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Suggested sessions from the topics tripping you up most. Each is
              10 untimed questions across all three formats.
            </p>
          </div>

          <ul className="divide-y border-t">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.topic}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {suggestion.topic}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Correct rate {formatPercent(suggestion.correctRate)} across{" "}
                    {suggestion.attempts} question
                    {suggestion.attempts === 1 ? "" : "s"} · suggested at{" "}
                    {suggestion.difficulty.toLowerCase()}
                  </span>
                </span>
                <StartPlannedButton
                  topic={suggestion.topic}
                  difficulty={suggestion.difficulty}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
