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
  // with "I've got this". Either way it is gone from here — done is done, and a
  // list of things you have finished with is just more to read. The misses
  // themselves are untouched in the database; only this view hides them.
  const groups = groupMistakesByConcept(items).filter(
    (group) => !conceptState.retired.has(group.concept),
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
              {/* Shown on every open group, not only the tracked ones: a
                  concept scored 60–79 never got a ReviewItem, and it would be
                  the one you most want gone. The action writes a retired stub
                  in that case. Untagged is not a real concept, so it is out. */}
              {group.concept === UNTAGGED_CONCEPT ? null : (
                <RetireButton
                  concept={group.concept}
                  topic={group.mistakes[0]?.topic}
                  difficulty={group.mistakes[0]?.difficulty}
                  label="I've got this"
                />
              )}
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
    </div>
  );
}
