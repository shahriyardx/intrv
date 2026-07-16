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

        <dl className="space-y-3.5 text-sm">
          <Row label="Your answer">
            Promises are faster than timers, so the engine runs them first.
          </Row>
          <Row label="Correct answer">
            Promise callbacks go on the microtask queue, which the event loop
            drains completely after the current task and before it takes the
            next timer callback off the macrotask queue. Ordering is queue
            priority, not speed.
          </Row>
          <Row label="Feedback">
            You've got the observable behaviour right — the promise does run
            first — but the reason isn't speed. Nothing here is racing. Name the
            two queues and say when the loop drains each one, and this is a full
            mark.
          </Row>
        </dl>
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

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-pretty leading-relaxed">{children}</dd>
    </div>
  );
}
