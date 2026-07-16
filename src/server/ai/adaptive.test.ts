import { describe, expect, it } from "vitest";
import { calibratedLevel, nextRung, rungBreakdown } from "@/server/ai/adaptive";

describe("nextRung", () => {
  it("steps up exactly one rung on 2/3 or better", () => {
    expect(nextRung("MEDIUM", { correct: 2, total: 3 })).toBe("HARD");
    // A perfect batch still only advances a single rung.
    expect(nextRung("MEDIUM", { correct: 3, total: 3 })).toBe("HARD");
    expect(nextRung("HARD", { correct: 3, total: 3 })).toBe("EXPERT");
  });

  it("steps down on 1/3 or worse", () => {
    expect(nextRung("MEDIUM", { correct: 1, total: 3 })).toBe("EASY");
    expect(nextRung("MEDIUM", { correct: 0, total: 3 })).toBe("EASY");
  });

  it("holds between 1/3 and 2/3", () => {
    // A two-question batch split 1/2 is 0.5 — neither up nor down.
    expect(nextRung("MEDIUM", { correct: 1, total: 2 })).toBe("MEDIUM");
  });

  it("holds when there is no objective signal", () => {
    expect(nextRung("MEDIUM", { correct: 0, total: 0 })).toBe("MEDIUM");
  });

  it("caps at EXPERT and floors at BEGINNER", () => {
    expect(nextRung("EXPERT", { correct: 3, total: 3 })).toBe("EXPERT");
    expect(nextRung("BEGINNER", { correct: 0, total: 3 })).toBe("BEGINNER");
  });
});

describe("rungBreakdown", () => {
  it("tallies per rung in ladder order, only for rungs seen", () => {
    const out = rungBreakdown([
      { rung: "HARD", correct: true },
      { rung: "MEDIUM", correct: true },
      { rung: "MEDIUM", correct: false },
      { rung: "HARD", correct: true },
      { rung: "HARD", correct: false },
    ]);

    expect(out).toEqual([
      { rung: "MEDIUM", answered: 2, correct: 1 },
      { rung: "HARD", answered: 3, correct: 2 },
    ]);
  });

  it("is empty for no items", () => {
    expect(rungBreakdown([])).toEqual([]);
  });
});

describe("calibratedLevel", () => {
  it("picks the highest rung with >=2 answered and >=60% correct", () => {
    const level = calibratedLevel([
      { rung: "MEDIUM", correct: true },
      { rung: "MEDIUM", correct: true },
      { rung: "HARD", correct: true },
      { rung: "HARD", correct: true },
      { rung: "HARD", correct: true },
    ]);
    expect(level).toBe("HARD");
  });

  it("does not credit a rung that fell below 60%", () => {
    const level = calibratedLevel([
      { rung: "MEDIUM", correct: true },
      { rung: "MEDIUM", correct: true },
      { rung: "HARD", correct: false },
      { rung: "HARD", correct: true },
      { rung: "HARD", correct: false },
    ]);
    expect(level).toBe("MEDIUM");
  });

  it("does not credit a rung with only one answered question", () => {
    const level = calibratedLevel([
      { rung: "EASY", correct: true },
      { rung: "EASY", correct: true },
      { rung: "MEDIUM", correct: true },
    ]);
    expect(level).toBe("EASY");
  });

  it("falls back to the lowest rung seen when nothing qualifies", () => {
    const level = calibratedLevel([
      { rung: "MEDIUM", correct: false },
      { rung: "HARD", correct: false },
    ]);
    expect(level).toBe("MEDIUM");
  });

  it("is null with no evidence", () => {
    expect(calibratedLevel([])).toBeNull();
  });
});
