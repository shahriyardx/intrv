import {
  CheckCircleIcon,
  FlameIcon,
  LightningIcon,
  MedalIcon,
  SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LevelBar } from "@/components/game/level-bar";
import { DataLabel } from "@/components/ui/prose";
import type { Progression } from "@/server/dal/learning";

/**
 * The payoff strip on the result page: what this run was worth.
 *
 * Signed-in, non-ASSESSMENT only — a screening attempt earns nothing, and an
 * anonymous run has nowhere to put the points.
 *
 * It deliberately does **not** claim which badges were newly unlocked. Badges
 * are derived (badges.ts), so there is no "earned at" to compare against, and
 * reconstructing the pre-session counters would mean guessing whether this
 * run's topic was already in the set. A wrong "new badge!" is worse than none,
 * so the strip shows the running total and links to the full grid instead.
 *
 * The level-up *is* claimed, because that one is exact: the level before this
 * run is the level of (total XP − this run's XP).
 */
export function SessionReward({
  xpEarned,
  progression,
  leveledUp,
}: {
  xpEarned: number;
  progression: Progression;
  leveledUp: boolean;
}) {
  return (
    <section
      aria-labelledby="reward"
      className="no-print mt-10 border-t pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
    >
      <div className="space-y-5">
        <DataLabel as="h2" id="reward">
          What this run was worth
        </DataLabel>

        {leveledUp ? (
          <p className="flex items-center gap-2 font-display text-display-md">
            <SparkleIcon
              aria-hidden
              weight="fill"
              className="size-5 shrink-0 text-primary"
            />
            Level {progression.level.level} — {progression.level.title}
          </p>
        ) : null}

        <LevelBar level={progression.level} />
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-x-6 lg:mt-0">
        <Stat
          icon={
            <LightningIcon aria-hidden weight="fill" className="size-3.5" />
          }
          label="Earned"
          value={`+${xpEarned.toLocaleString()}`}
          note="XP"
        />
        <Stat
          icon={<FlameIcon aria-hidden weight="fill" className="size-3.5" />}
          label="Streak"
          value={progression.currentStreak.toLocaleString()}
          note={
            progression.goalMetToday ? "Today is done" : "Not counted yet today"
          }
        />
        <Stat
          icon={<MedalIcon aria-hidden weight="fill" className="size-3.5" />}
          label="Badges"
          value={`${progression.earned}/${progression.total}`}
          note={
            <Link
              href="/dashboard"
              className="underline underline-offset-4 hover:text-foreground"
            >
              See all
            </Link>
          }
        />
      </dl>

      {progression.goalMetToday ? (
        <p className="mt-6 flex items-center gap-2 text-muted-foreground text-xs lg:col-span-2">
          <CheckCircleIcon
            aria-hidden
            weight="fill"
            className="size-3.5 shrink-0 text-correct"
          />
          Today's goal is done — your streak is safe.
        </p>
      ) : null}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 font-display text-display-md leading-none tabular">
        {value}
      </dd>
      <dd className="mt-2 text-muted-foreground text-xs">{note}</dd>
    </div>
  );
}
