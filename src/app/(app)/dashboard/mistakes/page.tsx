import { CaretRightIcon, SealCheckIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { MistakeCard } from "@/components/analytics/mistake-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataLabel, Prose } from "@/components/ui/prose";
import {
  getMistakes,
  groupMistakesByConcept,
  UNTAGGED_CONCEPT,
} from "@/server/dal/analytics";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Mistakes" };

/** The first groups open on arrival; the long tail stays folded. */
const OPEN_BY_DEFAULT = 2;

export default async function MistakesPage() {
  const viewer = await getViewer();
  const { items, capped } = await getMistakes(viewer, { limit: 100 });

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

  const groups = groupMistakesByConcept(items);

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
