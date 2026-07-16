import { DIFFICULTIES, type Difficulty } from "@/lib/schemas";

/**
 * Learning-path suggestion math. Pure so the difficulty-ladder logic is testable
 * without a database. DIFFICULTIES is the single source of ladder order (see
 * src/lib/schemas.ts) — never hard-code the rungs here.
 */

/** At or above this correct-rate (%), a topic holds its rung; below it, drop one. */
export const WEAK_CORRECT_RATE = 60;

/**
 * What difficulty to suggest next for a topic. A weak topic steps one rung down
 * the ladder to rebuild footing; anything comfortable holds its ground. Never
 * steps below the easiest rung.
 */
export function suggestDifficulty(
  base: Difficulty,
  correctRate: number,
): Difficulty {
  if (correctRate >= WEAK_CORRECT_RATE) return base;
  const i = DIFFICULTIES.indexOf(base);
  return DIFFICULTIES[Math.max(0, i - 1)];
}

/** The harder of two difficulties by ladder order. */
export function harderDifficulty(a: Difficulty, b: Difficulty): Difficulty {
  return DIFFICULTIES.indexOf(a) >= DIFFICULTIES.indexOf(b) ? a : b;
}
