import { describe, expect, it } from "vitest";
import {
  DAILY_TOPICS,
  dailyTopicFor,
  dailyTopicIndex,
  dateKeyUTC,
} from "./daily-schedule";

describe("dateKeyUTC", () => {
  it("formats a UTC calendar day as YYYY-MM-DD", () => {
    expect(dateKeyUTC(new Date("2026-07-17T12:34:56Z"))).toBe("2026-07-17");
  });

  it("keys by UTC, not local time — a moment past UTC midnight is the new day", () => {
    // 00:30 UTC on the 18th is still the 17th in any negative-offset zone, but
    // the key must be UTC so every server and player agrees on the day.
    expect(dateKeyUTC(new Date("2026-07-18T00:30:00Z"))).toBe("2026-07-18");
  });

  it("zero-pads month and day", () => {
    expect(dateKeyUTC(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });
});

describe("dailyTopicIndex", () => {
  it("always lands inside the topic list", () => {
    for (let d = 1; d <= 31; d++) {
      const key = `2026-03-${String(d).padStart(2, "0")}`;
      const index = dailyTopicIndex(key);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(DAILY_TOPICS.length);
      expect(Number.isInteger(index)).toBe(true);
    }
  });

  it("is deterministic for a given key", () => {
    expect(dailyTopicIndex("2026-07-17")).toBe(dailyTopicIndex("2026-07-17"));
  });

  it("spreads across topics rather than collapsing to one", () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 28; d++) {
      seen.add(dailyTopicIndex(`2026-02-${String(d).padStart(2, "0")}`));
    }
    // A month of days should touch several different topics, not just one.
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe("dailyTopicFor", () => {
  it("returns a topic from the fixed list", () => {
    expect(DAILY_TOPICS).toContain(dailyTopicFor("2026-07-17"));
  });

  it("is stable for the same day", () => {
    expect(dailyTopicFor("2026-07-17")).toBe(dailyTopicFor("2026-07-17"));
  });
});
