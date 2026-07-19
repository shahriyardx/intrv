import { MinusCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { DataLabel, Prose } from "@/components/ui/prose";

/**
 * A hand-built still of a real graded short answer. It mirrors ReviewCard in
 * components/session/result-view.tsx — same rows, same verdict tokens, same
 * icon-plus-label rule — because the argument only lands if the picture is the
 * product. If that card's anatomy changes, this should change with it.
 */

const CONCEPTS = [
  { name: "Event loop", missed: 1, total: 2 },
  { name: "Microtask queue", missed: 1, total: 1 },
  { name: "Task scheduling", missed: 0, total: 2 },
];

export function GradedQuestionMock() {
  return (
    <div className="rounded-md border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-5">
        <div>
          <DataLabel>Question 4 of 8</DataLabel>
          <p className="mt-1.5 font-display text-display-md">
            JavaScript concurrency
          </p>
        </div>
        <div className="text-right">
          <DataLabel>Score</DataLabel>
          <p className="font-display text-display-md tabular leading-none">
            60%
          </p>
        </div>
      </div>

      <article className="pt-5">
        <header className="mb-5 flex items-start justify-between gap-4">
          <Prose className="font-medium">
            Why does a promise callback run before a setTimeout callback that
            was scheduled first?
          </Prose>
          {/* Icon + label, never colour alone — matches VERDICT in result-view. */}
          <span className="flex shrink-0 items-center gap-1.5 rounded bg-partial-muted px-2 py-1 text-xs">
            <MinusCircleIcon className="size-4 text-partial" weight="fill" />
            <span className="font-medium">Partly right</span>
          </span>
        </header>

        {/* Two answers side by side, coloured by verdict — the comparison is
            the point. Mirrors the grid in result-view's ReviewCard; stacking
            them label-left made the card tall and the colour was the thing that
            actually carried the meaning. */}
        <div className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
          <div className="space-y-1.5">
            <DataLabel as="dt">Your answer</DataLabel>
            <p className="text-partial leading-relaxed">
              Promises are faster than timers, so the engine runs them first.
            </p>
          </div>
          <div className="space-y-1.5">
            <DataLabel as="dt">Correct answer</DataLabel>
            <p className="text-correct leading-relaxed">
              Promise callbacks go on the microtask queue, which the event loop
              drains after the current task, before the next timer callback.
              Ordering is queue priority, not speed.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <DataLabel as="dt">Feedback</DataLabel>
          <Prose className="mt-1.5 text-sm">
            You've got the observable behaviour right — the promise does run
            first — but the reason isn't speed. Name the two queues and say when
            the loop drains each one, and this is a full mark.
          </Prose>
        </div>
      </article>

      <div className="mt-6 border-t pt-5">
        <DataLabel as="h3">What to study next</DataLabel>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONCEPTS.filter((c) => c.missed > 0).map((concept) => (
            <span
              key={concept.name}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            >
              {concept.name}
              <span className="font-mono text-[0.625rem] tabular text-muted-foreground">
                {concept.missed}/{concept.total} missed
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
