import { ClockCountdownIcon } from "@phosphor-icons/react/dist/ssr";
import { formatPercent, formatScore } from "@/components/analytics/format";
import type { ConceptMastery } from "@/server/dal/learning";

/**
 * The concept mastery grid.
 *
 * A meter, not a chart: each row is one correct-rate ratio against 100%, with
 * the number printed beside the bar, so the fill is a reading aid and never the
 * only way to get the value. Extends the visual language of WeakConcepts — same
 * bar, same chart-1 hue, same "N/M right" figure — rather than forking it.
 *
 * The "due" marker is icon + label, never colour alone: a reader who can't tell
 * two fills apart still gets the word.
 */
export function MasteryMap({
  concepts,
  remaining,
}: {
  concepts: ConceptMastery[];
  /** Concepts past the row cap, summarised rather than dropped silently. */
  remaining: number;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {concepts.map((concept) => (
          <li key={concept.concept} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-mono text-sm">
                  {concept.concept}
                </span>
                {concept.dueForReview ? (
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                    <ClockCountdownIcon className="size-3" aria-hidden />
                    Due
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
                {concept.correct}/{concept.attempts} right ·{" "}
                <span className="text-foreground">
                  {formatPercent(concept.correctRate)}
                </span>
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"
              role="img"
              aria-label={`${formatPercent(concept.correctRate)} correct on ${
                concept.concept
              } across ${concept.attempts} question${
                concept.attempts === 1 ? "" : "s"
              }${concept.dueForReview ? ", due for review" : ""}`}
            >
              <div
                className="h-full rounded-sm bg-[var(--chart-1)]"
                style={{ width: `${Math.max(concept.correctRate, 1.5)}%` }}
              />
            </div>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              avg {formatScore(concept.averageScore)}% ·{" "}
              {concept.topics.slice(0, 2).join(", ")}
              {concept.topics.length > 2
                ? ` +${concept.topics.length - 2}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="text-xs text-muted-foreground">
          + {remaining} more concept{remaining === 1 ? "" : "s"} with less
          history.
        </p>
      ) : null}
    </div>
  );
}
