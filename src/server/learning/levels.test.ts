import { describe, expect, it } from "vitest";
import {
  levelForXp,
  levelProgress,
  levelTitle,
  sessionXp,
  xpForLevel,
} from "./levels";

describe("xpForLevel", () => {
  it("starts at zero", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-3)).toBe(0);
  });

  it("follows the published curve", () => {
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
    expect(xpForLevel(5)).toBe(1_000);
    expect(xpForLevel(10)).toBe(4_500);
    expect(xpForLevel(20)).toBe(19_000);
  });

  it("is strictly increasing", () => {
    for (let l = 1; l < 40; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    }
  });
});

describe("levelForXp", () => {
  it("floors at level 1", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(-500)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it("levels up exactly on the threshold", () => {
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(19_000)).toBe(20);
  });

  // The inverse must agree with the forward curve everywhere, including at the
  // boundaries where floating-point sqrt could land a hair under the integer.
  it("inverts xpForLevel at every boundary", () => {
    for (let l = 1; l <= 60; l++) {
      const threshold = xpForLevel(l);
      expect(levelForXp(threshold)).toBe(l);
      if (l > 1) expect(levelForXp(threshold - 1)).toBe(l - 1);
    }
  });
});

describe("levelTitle", () => {
  it("names five levels per tier", () => {
    expect(levelTitle(1)).toBe("Newcomer");
    expect(levelTitle(5)).toBe("Newcomer");
    expect(levelTitle(6)).toBe("Apprentice");
    expect(levelTitle(11)).toBe("Practitioner");
    expect(levelTitle(26)).toBe("Authority");
  });

  it("clamps past the last tier rather than returning undefined", () => {
    expect(levelTitle(200)).toBe("Authority");
  });
});

describe("levelProgress", () => {
  it("reports position inside the level", () => {
    const p = levelProgress(200);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(100); // 200 − 100
    expect(p.levelSpan).toBe(200); // 300 − 100
    expect(p.toNext).toBe(100);
    expect(p.percent).toBe(50);
  });

  it("sits at zero percent on a fresh level", () => {
    const p = levelProgress(300);
    expect(p.level).toBe(3);
    expect(p.intoLevel).toBe(0);
    expect(p.percent).toBe(0);
  });

  it("survives junk input", () => {
    for (const xp of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = levelProgress(xp);
      expect(p.level).toBeGreaterThanOrEqual(1);
      expect(p.percent).toBeGreaterThanOrEqual(0);
      expect(p.percent).toBeLessThanOrEqual(100);
    }
  });

  it("never reports a percent outside 0–100", () => {
    for (let xp = 0; xp < 25_000; xp += 137) {
      const p = levelProgress(xp);
      expect(p.percent).toBeGreaterThanOrEqual(0);
      expect(p.percent).toBeLessThan(100);
      expect(p.toNext).toBeGreaterThan(0);
    }
  });
});

describe("sessionXp", () => {
  it("matches the leaderboard formula", () => {
    expect(sessionXp(70, 1.5, 10)).toBe(105);
    expect(sessionXp(100, 3, 20)).toBe(600);
    expect(sessionXp(0, 2, 10)).toBe(0);
  });
});
