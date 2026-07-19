import { CaretRightIcon, SealCheckIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { MistakeCard } from "@/components/analytics/mistake-card";
import { RetireButton } from "@/components/analytics/retire-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataLabel, Prose } from "@/components/ui/prose";
import {
  getMistakes,
  groupMistakesByConcept,
  UNTAGGED_CONCEPT,
} from "@/server/dal/analytics";
import { getReviewConceptState } from "@/server/dal/learning";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Mistakes" };

/** The first groups open on arrival; the long tail stays folded. */
const OPEN_BY_DEFAULT = 2;

export default async function MistakesPage() {
  const viewer = await getViewer();
  const [{ items, capped }, conceptState] = await Promise.all([
    getMistakes(viewer, { limit: 100 }),
    getReviewConceptState(viewer),
  ]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<SealCheckIcon />}
        title="No mistakes to review"
        description="Once a graded interview turns up a question you got wrong, it lands here — with the right answer and why it's right, grouped by what it was testing."
        action={
          <Button asChild>
            <Link href="/start">Start an interview</Link>
          </Button>
        }
      />
    );
  }

  // Retired means the concept was either mastered on the ladder or dismissed
  // with "I've got this". Those fold to the bottom; everything else — including
  // concepts that were never scheduled — stays in the main list.
  const allGroups = groupMistakesByConcept(items);
  const groups = allGroups.filter((g) => !conceptState.retired.has(g.concept));
  const clearedGroups = allGroups.filter((g) =>
    conceptState.retired.has(g.concept),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <Prose className="text-sm text-muted-foreground">
          <p>
            {items.length} {items.length === 1 ? "question" : "questions"} you
            got wrong or only partly right, grouped by what they were testing.
            The concepts that cost you the most come first.
          </p>
        </Prose>
        {capped ? (
          <p className="text-xs text-muted-foreground">
            Showing your 100 most recent.
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {groups.map((group, i) => (
          // <details> rather than an accordion component: this page is long, it
          // is all server-rendered, and folding it needs no JavaScript at all.
          <details
            key={group.concept}
            open={i < OPEN_BY_DEFAULT}
            className="group rounded-md border"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-muted/50">
              <CaretRightIcon
                className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                weight="bold"
                aria-hidden
              />
              <span className="font-display text-lg">
                {group.concept === UNTAGGED_CONCEPT ? (
                  <span className="text-muted-foreground">Untagged</span>
                ) : (
                  group.concept
                )}
              </span>
              <DataLabel className="ml-auto">
                {group.mistakes.length}{" "}
                {group.mistakes.length === 1 ? "miss" : "misses"}
              </DataLabel>
              {conceptState.active.has(group.concept) ? (
                <RetireButton concept={group.concept} label="I've got this" />
              ) : null}
            </summary>

            <ul className="space-y-4 border-t p-4">
              {group.mistakes.map((mistake) => (
                <li key={mistake.question.id}>
                  <MistakeCard mistake={mistake} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {clearedGroups.length > 0 ? (
        <section className="space-y-3 border-t pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <DataLabel as="h2">Done with</DataLabel>
            <p className="text-muted-foreground text-xs">
              Mastered on the review ladder, or dismissed. The misses are still
              here — nothing was deleted.
            </p>
          </div>
          <ul className="divide-y border-t">
            {clearedGroups.map((group) => (
              <li
                key={group.concept}
                className="flex items-center gap-4 py-2.5 text-muted-foreground text-sm"
              >
                <SealCheckIcon className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {group.concept === UNTAGGED_CONCEPT
                    ? "Untagged"
                    : group.concept}
                </span>
                <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                  {group.mistakes.length}{" "}
                  {group.mistakes.length === 1 ? "miss" : "misses"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
