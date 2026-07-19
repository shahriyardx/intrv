import { describe, expect, it } from "vitest";
import {
  BADGE_COUNT,
  type BadgeStats,
  earnedCount,
  evaluateBadges,
} from "./badges";

const EMPTY: BadgeStats = {
  gradedCount: 0,
  currentStreak: 0,
  longestStreak: 0,
  xp: 0,
  level: 1,
  perfectCount: 0,
  topicCount: 0,
  hardCount: 0,
  retiredReviews: 0,
  dailyCount: 0,
};

describe("evaluateBadges", () => {
  it("returns every badge, earned or not", () => {
    expect(evaluateBadges(EMPTY)).toHaveLength(BADGE_COUNT);
  });

  it("earns nothing on a brand-new account", () => {
    const badges = evaluateBadges(EMPTY);
    expect(earnedCount(badges)).toBe(0);
  });

  // Not every counter starts at zero — a new account is already level 1, so
  // the level badges show real progress before anything has been done. What
  // must hold is that none of them are *earned*.
  it("never shows full progress on a counter that has not been met", () => {
    const badges = evaluateBadges(EMPTY);
    for (const badge of badges) {
      expect(badge.percent).toBeLessThan(100);
      expect(badge.earned).toBe(false);
    }
  });

  it("earns on the threshold, not one past it", () => {
    const at = evaluateBadges({ ...EMPTY, gradedCount: 10 });
    expect(at.find((b) => b.id === "ten-runs")?.earned).toBe(true);

    const under = evaluateBadges({ ...EMPTY, gradedCount: 9 });
    expect(under.find((b) => b.id === "ten-runs")?.earned).toBe(false);
    expect(under.find((b) => b.id === "ten-runs")?.percent).toBe(90);
  });

  it("earns lower tiers of the same counter too", () => {
    const badges = evaluateBadges({ ...EMPTY, gradedCount: 50 });
    for (const id of ["first-run", "ten-runs", "fifty-runs"]) {
      expect(badges.find((b) => b.id === id)?.earned).toBe(true);
    }
  });

  // A streak badge must survive a broken streak: it reads longestStreak, so
  // earning "Week straight" and then missing a day cannot un-earn it.
  it("keys streak badges off the longest streak, not the current one", () => {
    const badges = evaluateBadges({
      ...EMPTY,
      currentStreak: 0,
      longestStreak: 7,
    });
    expect(badges.find((b) => b.id === "streak-7")?.earned).toBe(true);
  });

  it("caps the progress label at the target", () => {
    const badges = evaluateBadges({ ...EMPTY, gradedCount: 999 });
    expect(badges.find((b) => b.id === "ten-runs")?.progressLabel).toBe(
      "10 / 10",
    );
  });

  it("clamps percent and ignores negative counters", () => {
    const badges = evaluateBadges({ ...EMPTY, gradedCount: -5 });
    expect(badges.every((b) => b.percent >= 0 && b.percent <= 100)).toBe(true);
  });

  it("sorts earned first, then closest to earned", () => {
    const badges = evaluateBadges({
      ...EMPTY,
      gradedCount: 1, // earns first-run
      topicCount: 4, // 80% of explorer
      hardCount: 1, // 20% of deep-end
    });

    const firstUnearned = badges.findIndex((b) => !b.earned);
    expect(badges.slice(0, firstUnearned).every((b) => b.earned)).toBe(true);

    const locked = badges.slice(firstUnearned);
    for (let i = 1; i < locked.length; i++) {
      expect(locked[i].percent).toBeLessThanOrEqual(locked[i - 1].percent);
    }
    expect(locked[0].id).toBe("explorer");
  });

  it("has unique ids", () => {
    const ids = evaluateBadges(EMPTY).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
