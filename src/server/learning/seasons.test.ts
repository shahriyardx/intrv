import { describe, expect, it } from "vitest";
import { seasonSince, toSeasonPeriod } from "@/server/learning/seasons";

describe("toSeasonPeriod", () => {
  it("passes through the known periods", () => {
    expect(toSeasonPeriod("week")).toBe("week");
    expect(toSeasonPeriod("month")).toBe("month");
    expect(toSeasonPeriod("all")).toBe("all");
  });

  it("defaults anything else to all-time", () => {
    expect(toSeasonPeriod("nonsense")).toBe("all");
    expect(toSeasonPeriod(undefined)).toBe("all");
    expect(toSeasonPeriod(["week"])).toBe("all");
  });
});

describe("seasonSince", () => {
  // A Wednesday: 2026-07-15T14:30:00Z. getUTCDay() === 3.
  const wed = new Date("2026-07-15T14:30:00.000Z");

  it("returns null for all-time", () => {
    expect(seasonSince("all", wed)).toBeNull();
  });

  it("month starts at the first of the UTC month, midnight", () => {
    expect(seasonSince("month", wed)?.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("week rewinds to the preceding Sunday at UTC midnight", () => {
    // 2026-07-15 is a Wednesday; the Sunday before is 2026-07-12.
    expect(seasonSince("week", wed)?.toISOString()).toBe(
      "2026-07-12T00:00:00.000Z",
    );
  });

  it("on a Sunday, the week starts that same day", () => {
    const sun = new Date("2026-07-12T09:00:00.000Z"); // getUTCDay() === 0
    expect(seasonSince("week", sun)?.toISOString()).toBe(
      "2026-07-12T00:00:00.000Z",
    );
  });

  it("the month boundary rolls over correctly in January", () => {
    const jan = new Date("2026-01-20T00:00:00.000Z");
    expect(seasonSince("month", jan)?.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});
