import { describe, expect, it } from "vitest";
import { computeStreaks, utcDayIndex } from "@/server/learning/momentum";

describe("utcDayIndex", () => {
  it("assigns the same index across a whole UTC day", () => {
    const start = utcDayIndex(new Date("2026-07-17T00:00:00.000Z"));
    const end = utcDayIndex(new Date("2026-07-17T23:59:59.999Z"));
    expect(start).toBe(end);
  });

  it("increments at the UTC midnight boundary", () => {
    const a = utcDayIndex(new Date("2026-07-17T23:59:59.999Z"));
    const b = utcDayIndex(new Date("2026-07-18T00:00:00.000Z"));
    expect(b).toBe(a + 1);
  });
});

describe("computeStreaks", () => {
  const today = 20_000;

  it("is zero for no activity", () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, longest: 0 });
  });

  it("counts back from today", () => {
    expect(computeStreaks([today, today - 1, today - 2], today)).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it("survives a gap today when yesterday was active", () => {
    // Nothing yet today, but a run ending yesterday still counts.
    expect(computeStreaks([today - 1, today - 2], today)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("breaks once a full day is missed", () => {
    // Gap at today AND yesterday → the current streak is dead.
    expect(computeStreaks([today - 2, today - 3], today).current).toBe(0);
  });

  it("dedupes multiple sessions on the same day", () => {
    expect(computeStreaks([today, today, today - 1], today).current).toBe(2);
  });

  it("reports the longest historical run independent of the current one", () => {
    const days = [today, today - 5, today - 6, today - 7, today - 8];
    expect(computeStreaks(days, today)).toEqual({ current: 1, longest: 4 });
  });
});
