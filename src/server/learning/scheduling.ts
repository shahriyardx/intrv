/**
 * Spaced-repetition scheduling math. Pure and import-light so the interval
 * ladder is unit-testable without a database, a session, or a clock — the same
 * discipline owner.ts keeps for the access rules.
 */

/**
 * The interval ladder, in days, indexed by stage. A freshly missed (or lapsed)
 * concept sits at stage 0 and comes back in a day; each correct review climbs
 * one rung; clearing the top rung retires the item.
 */
export const INTERVAL_LADDER_DAYS = [1, 3, 7] as const;

/** Where a missed concept lands: stage 0, due in a day. */
export const RESET_STAGE = 0;
export const RESET_INTERVAL_DAYS = INTERVAL_LADDER_DAYS[RESET_STAGE];

export type Advancement =
  | { retire: true }
  | { retire: false; stage: number; intervalDays: number };

/**
 * The outcome of answering a due concept correctly: climb one rung, or retire
 * once the top of the ladder is cleared. Stage is the *current* stage; the
 * result carries the stage to move to.
 */
export function advanceStage(stage: number): Advancement {
  const next = stage + 1;
  if (next >= INTERVAL_LADDER_DAYS.length) return { retire: true };
  return {
    retire: false,
    stage: next,
    intervalDays: INTERVAL_LADDER_DAYS[next],
  };
}

/** The "1d / 3d / 7d" ladder label for a stage, clamped to the ladder. */
export function ladderLabel(stage: number): string {
  const i = Math.min(Math.max(stage, 0), INTERVAL_LADDER_DAYS.length - 1);
  return `${INTERVAL_LADDER_DAYS[i]}d`;
}

/**
 * Add whole days as exact 24h steps. Millisecond arithmetic on a UTC instant —
 * it never touches local time, so it cannot drift across a DST boundary the way
 * Date.prototype.setDate would.
 */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}
