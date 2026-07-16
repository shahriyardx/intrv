/**
 * Streak day math. Pure so the UTC-day boundary logic is testable in isolation:
 * the admin DAL once shipped a local-time bug in exactly this kind of code, so
 * day indices come from the UTC instant and nothing else.
 */

/** Whole days since the Unix epoch in UTC. 86_400_000 ms per day, floored. */
export function utcDayIndex(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

export type Streaks = { current: number; longest: number };

/**
 * Current and longest run of consecutive active UTC days.
 *
 * `current` counts back from today, but a gap *today* is forgiven when
 * yesterday was active: the streak stays alive until a whole day passes with
 * nothing graded. `longest` is the best run anywhere in the history.
 */
export function computeStreaks(
  dayIndices: Iterable<number>,
  todayIndex: number,
): Streaks {
  const days = new Set(dayIndices);
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = [...days].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // Anchor the current streak at today, or at yesterday when today is still
  // empty — a missed *today* does not end a streak, a missed full day does.
  let anchor: number | null = null;
  if (days.has(todayIndex)) anchor = todayIndex;
  else if (days.has(todayIndex - 1)) anchor = todayIndex - 1;

  let current = 0;
  for (let d = anchor ?? Number.NaN; days.has(d); d--) current++;

  return { current, longest };
}
