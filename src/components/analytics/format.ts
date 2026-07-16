/**
 * Shared by server tiles and client charts alike, so this module carries no
 * "use client" directive — a server component importing from a client module
 * would get a client reference, not a callable function.
 */

/** Trailing ".00" on a grade reads as false precision. Matches the result page. */
export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / false",
  SHORT_ANSWER: "Short answer",
};

export function questionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS[type] ?? type;
}

/** Axis and legend room is finite; a 60-character topic is not. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
