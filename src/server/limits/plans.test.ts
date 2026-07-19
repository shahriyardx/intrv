import { describe, expect, it } from "vitest";
import {
  limitsFor,
  nextUtcDayReset,
  PLAN_LIMITS,
  type Plan,
  startOfUtcDay,
} from "./plans";

describe("limitsFor", () => {
  it("returns the free numbers we advertise", () => {
    expect(limitsFor("FREE")).toEqual({
      interviewsPerDay: 5,
      assessmentsPerDay: 5,
      participantsPerAssessment: 100,
    });
  });

  it("never returns a limit below the free plan", () => {
    const free = limitsFor("FREE");
    for (const plan of Object.keys(PLAN_LIMITS) as Plan[]) {
      const limits = limitsFor(plan);
      expect(limits.interviewsPerDay).toBeGreaterThanOrEqual(
        free.interviewsPerDay,
      );
      expect(limits.assessmentsPerDay).toBeGreaterThanOrEqual(
        free.assessmentsPerDay,
      );
      expect(limits.participantsPerAssessment).toBeGreaterThanOrEqual(
        free.participantsPerAssessment,
      );
    }
  });

  // A bad column value must degrade to the strictest plan, never to unlimited.
  it("falls back to FREE for an unknown plan", () => {
    expect(limitsFor("ENTERPRISE" as Plan)).toEqual(limitsFor("FREE"));
  });

  it("has only positive limits", () => {
    for (const limits of Object.values(PLAN_LIMITS)) {
      for (const value of Object.values(limits)) {
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});

describe("startOfUtcDay", () => {
  it("floors to UTC midnight", () => {
    expect(startOfUtcDay(new Date("2026-07-19T13:45:12.345Z"))).toEqual(
      new Date("2026-07-19T00:00:00.000Z"),
    );
  });

  it("is a no-op at exactly midnight", () => {
    const midnight = new Date("2026-07-19T00:00:00.000Z");
    expect(startOfUtcDay(midnight)).toEqual(midnight);
  });

  // The boundary that matters: 23:59:59.999 and 00:00:00.000 are different
  // windows, so a quota spent late does not survive the rollover.
  it("puts either side of midnight in different windows", () => {
    const before = startOfUtcDay(new Date("2026-07-19T23:59:59.999Z"));
    const after = startOfUtcDay(new Date("2026-07-20T00:00:00.000Z"));
    expect(before).not.toEqual(after);
    expect(after.getTime() - before.getTime()).toBe(86_400_000);
  });

  it("does not follow local time", () => {
    // 2026-07-19T23:30 in UTC+13 is 2026-07-19T10:30Z — still the 19th in UTC.
    expect(startOfUtcDay(new Date("2026-07-19T10:30:00.000Z"))).toEqual(
      new Date("2026-07-19T00:00:00.000Z"),
    );
  });
});

describe("nextUtcDayReset", () => {
  it("is the following UTC midnight", () => {
    expect(nextUtcDayReset(new Date("2026-07-19T13:45:00.000Z"))).toEqual(
      new Date("2026-07-20T00:00:00.000Z"),
    );
  });

  it("is always in the future", () => {
    for (const iso of [
      "2026-07-19T00:00:00.000Z",
      "2026-07-19T12:00:00.000Z",
      "2026-07-19T23:59:59.999Z",
    ]) {
      const now = new Date(iso);
      expect(nextUtcDayReset(now).getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("is exactly one day after the window start", () => {
    const now = new Date("2026-07-19T08:12:34.000Z");
    expect(nextUtcDayReset(now).getTime() - startOfUtcDay(now).getTime()).toBe(
      86_400_000,
    );
  });
});
