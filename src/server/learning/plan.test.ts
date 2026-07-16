import { describe, expect, it } from "vitest";
import { harderDifficulty, suggestDifficulty } from "@/server/learning/plan";

describe("suggestDifficulty", () => {
  it("holds the rung when the topic is comfortable", () => {
    expect(suggestDifficulty("MEDIUM", 60)).toBe("MEDIUM");
    expect(suggestDifficulty("HARD", 85)).toBe("HARD");
  });

  it("drops one rung when the topic is weak", () => {
    expect(suggestDifficulty("MEDIUM", 42)).toBe("EASY");
    expect(suggestDifficulty("EXPERT", 30)).toBe("HARD");
  });

  it("never steps below the easiest rung", () => {
    expect(suggestDifficulty("BEGINNER", 10)).toBe("BEGINNER");
  });
});

describe("harderDifficulty", () => {
  it("picks the harder rung either way round", () => {
    expect(harderDifficulty("EASY", "HARD")).toBe("HARD");
    expect(harderDifficulty("EXPERT", "MEDIUM")).toBe("EXPERT");
    expect(harderDifficulty("MEDIUM", "MEDIUM")).toBe("MEDIUM");
  });
});
