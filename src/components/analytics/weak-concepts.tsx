import { formatPercent } from "@/components/analytics/format";
import type { ConceptAccuracy } from "@/server/dal/analytics";

/**
 * The "study this next" list.
 *
 * A meter rather than a chart: each row is one ratio against a limit, and the
 * number is printed beside every bar, so the fill is a reading aid and never
 * the only way to get the value.
 */
export function WeakConcepts({ concepts }: { concepts: ConceptAccuracy[] }) {
  return (
    <ul className="space-y-4">
      {concepts.map((concept) => (
        <li key={concept.concept} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-pretty">{concept.concept}</span>
            <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
              {concept.correct}/{concept.total} right ·{" "}
              <span className="text-foreground">
                {formatPercent(concept.accuracy)}
              </span>
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"
            role="img"
            aria-label={`${formatPercent(concept.accuracy)} accuracy on ${concept.concept}`}
          >
            <div
              className="h-full rounded-sm bg-[var(--chart-1)]"
              style={{ width: `${Math.max(concept.accuracy, 1.5)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
