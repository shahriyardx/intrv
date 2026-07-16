import { describe, expect, it } from "vitest";
import { computeSessionScore, gradeLocally } from "@/server/grading/local";

describe("gradeLocally — MCQ", () => {
  const key = { kind: "MCQ", key: "B" } as const;

  it("marks the matching key correct", () => {
    expect(gradeLocally(key, { kind: "MCQ", key: "B" })).toEqual({
      isCorrect: true,
      score: 100,
    });
  });

  it("ignores case drift between the model's key and the response", () => {
    // The keys are model-generated; a casing difference must never read as a
    // wrong answer.
    expect(gradeLocally(key, { kind: "MCQ", key: "b" })?.isCorrect).toBe(true);
  });

  it("marks a different key incorrect", () => {
    expect(gradeLocally(key, { kind: "MCQ", key: "A" })).toEqual({
      isCorrect: false,
      score: 0,
    });
  });

  it("treats unanswered as incorrect, not as an error", () => {
    expect(gradeLocally(key, null)).toEqual({ isCorrect: false, score: 0 });
  });

  it("rejects a response of the wrong shape", () => {
    expect(
      gradeLocally(key, { kind: "TRUE_FALSE", value: true })?.isCorrect,
    ).toBe(false);
  });
});

describe("gradeLocally — TRUE_FALSE", () => {
  it("compares booleans exactly", () => {
    const key = { kind: "TRUE_FALSE", value: true } as const;

    expect(
      gradeLocally(key, { kind: "TRUE_FALSE", value: true })?.isCorrect,
    ).toBe(true);
    expect(
      gradeLocally(key, { kind: "TRUE_FALSE", value: false })?.isCorrect,
    ).toBe(false);
  });

  it("grades a correct `false` answer as correct", () => {
    // Guards against a truthiness bug: false === false is a right answer.
    const key = { kind: "TRUE_FALSE", value: false } as const;

    expect(gradeLocally(key, { kind: "TRUE_FALSE", value: false })).toEqual({
      isCorrect: true,
      score: 100,
    });
  });
});

describe("gradeLocally — SHORT_ANSWER", () => {
  it("returns null so the caller routes it to the model", () => {
    expect(
      gradeLocally(
        { kind: "SHORT_ANSWER", expected: "x", keyPoints: [] },
        { kind: "SHORT_ANSWER", text: "x" },
      ),
    ).toBeNull();
  });
});

describe("computeSessionScore", () => {
  it("averages to two decimal places", () => {
    expect(computeSessionScore([100, 0, 100])).toBe(66.67);
  });

  it("handles a perfect and a zero session", () => {
    expect(computeSessionScore([100, 100])).toBe(100);
    expect(computeSessionScore([0, 0])).toBe(0);
  });

  it("returns 0 rather than NaN for an empty session", () => {
    expect(computeSessionScore([])).toBe(0);
  });

  it("keeps partial credit intact", () => {
    expect(computeSessionScore([100, 50])).toBe(75);
  });
});
