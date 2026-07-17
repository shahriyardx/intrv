import { describe, expect, it } from "vitest";
import {
  buildActivityCalendar,
  isoDate,
  weekdayOf,
} from "@/server/learning/activity";

describe("weekdayOf", () => {
  it("maps epoch day 0 (1970-01-01, a Thursday) to 4", () => {
    expect(weekdayOf(0)).toBe(4);
  });

  it("maps the first Sunday (1970-01-04, day 3) to 0", () => {
    expect(weekdayOf(3)).toBe(0);
  });

  it("stays in 0..6 for negative indices", () => {
    for (let d = -14; d <= 14; d++) {
      const w = weekdayOf(d);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(6);
    }
  });
});

describe("isoDate", () => {
  it("formats a day-index as UTC YYYY-MM-DD", () => {
    expect(isoDate(0)).toBe("1970-01-01");
    expect(isoDate(3)).toBe("1970-01-04");
  });
});

describe("buildActivityCalendar", () => {
  const today = 20_000; // arbitrary fixed index — no clock

  it("produces `weeks` full columns of 7 cells each", () => {
    const cal = buildActivityCalendar(new Map(), today, 53);
    expect(cal.columns).toHaveLength(53);
    for (const col of cal.columns) expect(col).toHaveLength(7);
  });

  it("starts each column on a Sunday", () => {
    const cal = buildActivityCalendar(new Map(), today, 10);
    for (const col of cal.columns) {
      expect(weekdayOf(col[0].dayIndex)).toBe(0);
    }
  });

  it("includes today and marks days after it as future spacers", () => {
    const cal = buildActivityCalendar(new Map(), today, 5);
    const flat = cal.columns.flat();
    expect(flat.some((c) => c.dayIndex === today)).toBe(true);
    expect(flat.every((c) => (c.dayIndex > today ? c.future : !c.future))).toBe(
      true,
    );
  });

  it("counts totals and active days, ignoring future cells", () => {
    const counts = new Map<number, number>([
      [today, 3],
      [today - 1, 1],
      [today - 2, 0],
      [today + 1, 99], // future: must never be counted
    ]);
    const cal = buildActivityCalendar(counts, today, 5);
    expect(cal.total).toBe(4);
    expect(cal.activeDays).toBe(2);
  });

  it("buckets counts into levels 0..4", () => {
    const counts = new Map<number, number>([
      [today, 0],
      [today - 1, 1],
      [today - 2, 3],
      [today - 3, 5],
      [today - 4, 20],
    ]);
    const cal = buildActivityCalendar(counts, today, 5);
    const byDay = new Map(cal.columns.flat().map((c) => [c.dayIndex, c.level]));
    expect(byDay.get(today)).toBe(0);
    expect(byDay.get(today - 1)).toBe(1);
    expect(byDay.get(today - 2)).toBe(2);
    expect(byDay.get(today - 3)).toBe(3);
    expect(byDay.get(today - 4)).toBe(4);
  });
});
