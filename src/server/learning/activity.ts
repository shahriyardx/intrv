/**
 * Grid math for the activity heatmap. Pure, like momentum.ts, so the
 * week-alignment and level-bucketing are testable without a database or a
 * clock — the same discipline the UTC-day code already follows.
 *
 * Days are UTC day-indices (whole days since the epoch), the unit getMomentum
 * already streaks on, so the heatmap and the streak count can never disagree
 * about what day a session lands on.
 */

/**
 * Weekday of a UTC day-index, Sunday = 0 … Saturday = 6. Epoch day 0
 * (1970-01-01) is a Thursday = 4, so the phase shift is +4. Kept arithmetic
 * rather than `new Date(...).getUTCDay()` so it stays pure and cheap.
 */
export function weekdayOf(dayIndex: number): number {
  return (((dayIndex + 4) % 7) + 7) % 7;
}

/** ISO YYYY-MM-DD for a day-index. Deterministic from the input — no clock. */
export function isoDate(dayIndex: number): string {
  return new Date(dayIndex * 86_400_000).toISOString().slice(0, 10);
}

export type Cell = {
  dayIndex: number;
  date: string;
  count: number;
  /** 0 (none) … 4 (most). Buckets, so one huge day doesn't flatten the rest. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Days after today render as empty spacers to keep the last column full. */
  future: boolean;
};

export type ActivityCalendar = {
  /** Columns left→right oldest→newest; each is 7 cells, Sun (top) → Sat. */
  columns: Cell[][];
  total: number;
  /** Active days in the window — the denominator-free "how consistent" number. */
  activeDays: number;
};

function levelFor(count: number): Cell["level"] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/**
 * Build a GitHub-style grid ending today. The window starts `weeks` columns
 * back and is pulled to the preceding Sunday so every column is a full week and
 * the weekday rows line up. Cells past today are `future` spacers.
 */
export function buildActivityCalendar(
  countsByDayIndex: Map<number, number>,
  todayIndex: number,
  weeks = 53,
): ActivityCalendar {
  // Anchor the last column on the current week's Sunday so today is always in
  // it, then count `weeks - 1` columns back. Rewinding the *start* to Sunday
  // instead would push the window's end before today.
  const currentSunday = todayIndex - weekdayOf(todayIndex);
  const start = currentSunday - (weeks - 1) * 7;

  const columns: Cell[][] = [];
  let total = 0;
  let activeDays = 0;

  for (let col = 0; col < weeks; col++) {
    const cells: Cell[] = [];
    for (let row = 0; row < 7; row++) {
      const dayIndex = start + col * 7 + row;
      const future = dayIndex > todayIndex;
      const count = future ? 0 : (countsByDayIndex.get(dayIndex) ?? 0);
      if (!future && count > 0) {
        total += count;
        activeDays++;
      }
      cells.push({
        dayIndex,
        date: isoDate(dayIndex),
        count,
        level: levelFor(count),
        future,
      });
    }
    columns.push(cells);
  }

  return { columns, total, activeDays };
}
