/**
 * XP → level. Import-free and pure, like owner.ts and username.ts, so the curve
 * is unit-testable and the dashboard, the profile and the result page can never
 * disagree about what level someone is.
 *
 * XP itself is not a new column — it is the leaderboard points formula summed
 * over a user's graded sessions (see DIFFICULTY_MULTIPLIER). This module only
 * maps that number onto a ladder.
 */

/**
 * XP needed to *reach* a level: 50·(L−1)·L.
 *
 *   L2 = 100   L3 = 300   L4 = 600   L5 = 1_000   L10 = 4_500   L20 = 19_000
 *
 * A single ten-question MEDIUM session at 70% is worth ~105 XP, so the first
 * level lands after one good run and the gaps widen from there. Quadratic, not
 * exponential: an exponential curve stalls out around level 12 and the number
 * stops moving, which is the failure mode we are trying to avoid.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * (level - 1) * level;
}

/** Highest level whose threshold `xp` has passed. Never below 1. */
export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  // Invert 50·(L−1)·L ≤ xp  →  L ≤ (1 + √(1 + xp/12.5)) / 2
  const level = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
  return Math.max(1, level);
}

export type LevelProgress = {
  level: number;
  /** Rank name for the level's tier — five levels per tier. */
  title: string;
  /** Total lifetime XP, unchanged. */
  xp: number;
  /** XP earned since this level started. */
  intoLevel: number;
  /** XP the whole level spans. Null once past the last named tier — never here. */
  levelSpan: number;
  /** XP still needed for the next level. */
  toNext: number;
  /** 0–100, how far through the current level. */
  percent: number;
};

/**
 * Tier names, one per five levels. Deliberately plain — this is a technical
 * product, not a fantasy game, so the ladder reads like seniority.
 */
const TITLES = [
  "Newcomer", // 1–5
  "Apprentice", // 6–10
  "Practitioner", // 11–15
  "Specialist", // 16–20
  "Expert", // 21–25
  "Authority", // 26–30
] as const;

export function levelTitle(level: number): string {
  const tier = Math.floor((Math.max(1, level) - 1) / 5);
  return TITLES[Math.min(tier, TITLES.length - 1)];
}

/** Everything a progress bar needs from a raw XP total. */
export function levelProgress(xp: number): LevelProgress {
  const safeXp = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  const level = levelForXp(safeXp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const levelSpan = ceiling - floor;
  const intoLevel = safeXp - floor;

  return {
    level,
    title: levelTitle(level),
    xp: safeXp,
    intoLevel,
    levelSpan,
    toNext: ceiling - safeXp,
    percent: levelSpan === 0 ? 0 : (intoLevel / levelSpan) * 100,
  };
}

/**
 * Points one graded session is worth — the same formula the leaderboard and the
 * XP rollups use, extracted so the result page can show "+105 XP" without
 * re-deriving it (and drifting).
 */
export function sessionXp(
  score: number,
  multiplier: number,
  questionCount: number,
): number {
  return Math.round(score * multiplier * (questionCount / 10));
}
