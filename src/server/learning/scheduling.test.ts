import { describe, expect, it } from "vitest";
import {
  addDays,
  advanceStage,
  INTERVAL_LADDER_DAYS,
  ladderLabel,
  RESET_INTERVAL_DAYS,
} from "@/server/learning/scheduling";

describe("advanceStage", () => {
  it("climbs 0 → 1 with a 3-day interval", () => {
    expect(advanceStage(0)).toEqual({
      retire: false,
      stage: 1,
      intervalDays: 3,
    });
  });

  it("climbs 1 → 2 with a 7-day interval", () => {
    expect(advanceStage(1)).toEqual({
      retire: false,
      stage: 2,
      intervalDays: 7,
    });
  });

  it("retires once the top rung is cleared", () => {
    expect(advanceStage(2)).toEqual({ retire: true });
    // Defensive: an out-of-range stage still retires rather than indexing past
    // the ladder.
    expect(advanceStage(5)).toEqual({ retire: true });
  });
});

describe("ladderLabel", () => {
  it("maps each stage to its interval label", () => {
    expect(ladderLabel(0)).toBe("1d");
    expect(ladderLabel(1)).toBe("3d");
    expect(ladderLabel(2)).toBe("7d");
  });

  it("clamps out-of-range stages to the ends of the ladder", () => {
    expect(ladderLabel(-1)).toBe("1d");
    expect(ladderLabel(9)).toBe("7d");
  });
});

describe("addDays", () => {
  it("adds exact 24h steps on a UTC instant", () => {
    const from = new Date("2026-07-17T12:00:00.000Z");
    expect(addDays(from, 1).toISOString()).toBe("2026-07-18T12:00:00.000Z");
    expect(addDays(from, RESET_INTERVAL_DAYS).toISOString()).toBe(
      "2026-07-18T12:00:00.000Z",
    );
    expect(addDays(from, 7).toISOString()).toBe("2026-07-24T12:00:00.000Z");
  });

  it("does not mutate its argument", () => {
    const from = new Date("2026-07-17T00:00:00.000Z");
    addDays(from, 3);
    expect(from.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });
});

describe("INTERVAL_LADDER_DAYS", () => {
  it("is the 1d → 3d → 7d ladder", () => {
    expect([...INTERVAL_LADDER_DAYS]).toEqual([1, 3, 7]);
  });
});
