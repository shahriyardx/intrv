/**
 * Pure adaptive-difficulty logic. Deliberately free of server imports (only a
 * type and the difficulty ladder from the shared schema) so the stepping and
 * calibration rules are unit-testable without a database, a model call, or a
 * request. Both the generation loop and the result page depend on this being
 * the single source of truth for how a rung moves.
 */
import { DIFFICULTIES, type Difficulty } from "@/lib/schemas";

/**
 * The ladder is exactly the difficulty enum, ordered easiest → hardest. An
 * adaptive session starts on `session.difficulty` and steps along this.
 */
export const LADDER = DIFFICULTIES;

/** A rung's objective result: how many were correct out of how many answered. */
export type ObjectiveSignal = { correct: number; total: number };

/**
 * Decides the next rung from one batch's objective answers.
 *
 * ≥2/3 correct steps up (capped at the hardest rung); ≤1/3 steps down (floored
 * at the easiest); anything between holds. A batch with no answered objective
 * questions carries no signal, so it holds too — never guess a direction from
 * nothing.
 */
export function nextRung(
  current: Difficulty,
  objective: ObjectiveSignal,
): Difficulty {
  if (objective.total <= 0) return current;

  const fraction = objective.correct / objective.total;
  const i = LADDER.indexOf(current);
  const here = i === -1 ? 0 : i;

  if (fraction >= 2 / 3) return LADDER[Math.min(here + 1, LADDER.length - 1)];
  if (fraction <= 1 / 3) return LADDER[Math.max(here - 1, 0)];
  return current;
}

export type RungStat = { rung: Difficulty; answered: number; correct: number };

/**
 * Per-rung answered/correct tally, in ladder order and only for rungs that were
 * actually reached. Feeds the "MEDIUM 3/3 · HARD 2/4" breakdown on the result
 * page.
 */
export function rungBreakdown(
  items: { rung: Difficulty; correct: boolean }[],
): RungStat[] {
  const byRung = new Map<Difficulty, RungStat>();

  for (const item of items) {
    const stat = byRung.get(item.rung) ?? {
      rung: item.rung,
      answered: 0,
      correct: 0,
    };
    stat.answered++;
    if (item.correct) stat.correct++;
    byRung.set(item.rung, stat);
  }

  return LADDER.reduce<RungStat[]>((acc, rung) => {
    const stat = byRung.get(rung);
    if (stat) acc.push(stat);
    return acc;
  }, []);
}

/**
 * The rung a student demonstrably reached: the highest one with at least two
 * answered questions and at least 60% correct. With too little evidence at any
 * rung it falls back to the lowest rung seen, so a short or shaky session still
 * reports something honest rather than nothing. Null when there is no evidence
 * at all.
 */
export function calibratedLevel(
  items: { rung: Difficulty; correct: boolean }[],
): Difficulty | null {
  const stats = rungBreakdown(items);
  if (stats.length === 0) return null;

  for (let i = stats.length - 1; i >= 0; i--) {
    const stat = stats[i];
    if (stat.answered >= 2 && stat.correct / stat.answered >= 0.6) {
      return stat.rung;
    }
  }

  // Ordered by ladder, so the first entry is the lowest rung actually reached.
  return stats[0].rung;
}
