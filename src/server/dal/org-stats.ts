/**
 * The maths behind the org analytics.
 *
 * Import-free on purpose, like `owner.ts`: these functions decide what a
 * recruiter is told about a candidate and about their own assessment, so they must
 * be testable without a database or an environment.
 */

export type ScoreBucket = { label: string; count: number };

export type QuestionVerdict =
  | "no-signal"
  | "too-hard"
  | "discriminates"
  | "insufficient";

/**
 * Below this many answers a pass rate is noise. Two of three candidates failing
 * says nothing about a question, and claiming it does would send someone off to
 * rewrite a perfectly good one.
 */
export const MIN_QUESTION_SAMPLE = 5;

/** Median, not mean: one zero shouldn't drag the cohort's centre with it. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

/** Nearest-rank percentile. Takes any order; sorts its own copy. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);

  return sorted[index] as number;
}

/**
 * The share of the cohort a score strictly beats.
 *
 * Strictly, so "beats 84%" is literally true. Counting ties would put the worst
 * candidate in a cohort above zero and the only candidate in a cohort of one at
 * 100% — both true and useless.
 */
export function beatsShare(score: number, cohort: number[]): number {
  if (cohort.length === 0) return 0;
  return Math.round(
    (cohort.filter((s) => s < score).length / cohort.length) * 100,
  );
}

const BANDS = [
  { label: "0–20", min: 0, max: 20 },
  { label: "20–40", min: 20, max: 40 },
  { label: "40–60", min: 40, max: 60 },
  { label: "60–80", min: 60, max: 80 },
  // Half-open like the rest, so the top band needs the extra room to hold 100.
  { label: "80–100", min: 80, max: 100.01 },
] as const;

export function bucketScores(scores: number[]): ScoreBucket[] {
  return BANDS.map((band) => ({
    label: band.label,
    count: scores.filter((s) => s >= band.min && s < band.max).length,
  }));
}

/**
 * What a question's pass rate says about the question.
 *
 * A question nearly everyone passes is costing a slot without buying
 * information; one nearly nobody passes is usually ambiguous rather than hard.
 */
export function verdictFor(passed: number, answered: number): QuestionVerdict {
  if (answered < MIN_QUESTION_SAMPLE) return "insufficient";

  const rate = passed / answered;
  if (rate >= 0.9) return "no-signal";
  if (rate <= 0.15) return "too-hard";
  return "discriminates";
}
