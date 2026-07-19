import type { Metadata } from "next";
import { BadgeGrid } from "@/components/game/badge-grid";
import { LevelBar } from "@/components/game/level-bar";
import { DataLabel, Prose } from "@/components/ui/prose";
import { getProgression } from "@/server/dal/learning";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Badges" };

/**
 * The full shelf: every badge, earned and locked, with what each one takes.
 *
 * The overview shows only the earned ones as bare icons — a wall of grey
 * placeholders is not a thing to greet someone with. This page is where the
 * locked ones belong, because here they read as a list of things to go and do
 * rather than a list of things you have not done.
 */
export default async function BadgesPage() {
  const viewer = await getViewer();
  const progression = await getProgression(viewer);

  const earned = progression.badges.filter((badge) => badge.earned);
  const locked = progression.badges.filter((badge) => !badge.earned);

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <DataLabel as="h2">Level {progression.level.level}</DataLabel>
            <p className="mt-1 font-display text-display-md">
              {progression.level.title}
            </p>
          </div>
          <span className="font-mono text-muted-foreground text-xs tabular">
            {progression.earned} of {progression.total} badges
          </span>
        </div>
        <LevelBar level={progression.level} />
      </section>

      {earned.length > 0 ? (
        <section className="space-y-5">
          <DataLabel as="h2">Earned</DataLabel>
          <BadgeGrid badges={earned} />
        </section>
      ) : (
        <Prose className="text-muted-foreground text-sm">
          <p>
            Nothing earned yet. Take an interview and the first one lands
            straight away — the rest are below.
          </p>
        </Prose>
      )}

      {locked.length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <DataLabel as="h2">Still to get</DataLabel>
            <span className="font-mono text-muted-foreground text-xs tabular">
              closest first
            </span>
          </div>
          <BadgeGrid badges={locked} />
        </section>
      ) : (
        <Prose className="text-muted-foreground text-sm">
          <p>Every badge earned. There is nothing left to chase here.</p>
        </Prose>
      )}
    </div>
  );
}
