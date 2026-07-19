import { describe, expect, it } from "vitest";
import {
  isSeasonOpen,
  openSeasons,
  SEASONAL_BADGES,
  seasonalAwardsFor,
  seasonalById,
  topicEarns,
} from "./seasonal";

const FIFA = SEASONAL_BADGES.find((b) => b.id === "fifa-2026");
if (!FIFA)
  throw new Error("fifa-2026 is the fixture these tests are written against");

describe("isSeasonOpen", () => {
  it("is open on the first instant of the window", () => {
    expect(isSeasonOpen(FIFA, new Date("2026-06-01T00:00:00.000Z"))).toBe(true);
  });

  // The whole of the closing day counts — "until 20 July" means through it.
  it("is open all through the final day", () => {
    expect(isSeasonOpen(FIFA, new Date("2026-07-20T00:00:00.000Z"))).toBe(true);
    expect(isSeasonOpen(FIFA, new Date("2026-07-20T23:59:59.999Z"))).toBe(true);
  });

  it("is shut the moment the next day starts", () => {
    expect(isSeasonOpen(FIFA, new Date("2026-07-21T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("is shut before it opens", () => {
    expect(isSeasonOpen(FIFA, new Date("2026-05-31T23:59:59.999Z"))).toBe(
      false,
    );
  });
});

describe("topicEarns", () => {
  it("matches on a substring, case-insensitively", () => {
    for (const topic of [
      "FIFA",
      "fifa tactics",
      "FIFA World Cup 2026",
      "Offside rule in the World Cup",
    ]) {
      expect(topicEarns(FIFA, topic)).toBe(true);
    }
  });

  it("does not match an unrelated topic", () => {
    for (const topic of ["React hooks", "SQL joins", "world history"]) {
      expect(topicEarns(FIFA, topic)).toBe(false);
    }
  });

  it("ignores difficulty entirely — any rung earns it", () => {
    // Difficulty is not a parameter, which is the point; this is a
    // commemorative badge, not a skill one.
    expect(topicEarns(FIFA, "fifa")).toBe(true);
  });
});

describe("seasonalAwardsFor", () => {
  it("awards a matching topic inside the window", () => {
    expect(
      seasonalAwardsFor({
        topic: "FIFA World Cup",
        gradedAt: new Date("2026-07-01T12:00:00.000Z"),
      }),
    ).toEqual(["fifa-2026"]);
  });

  it("awards nothing once the window has shut", () => {
    expect(
      seasonalAwardsFor({
        topic: "FIFA World Cup",
        gradedAt: new Date("2026-07-21T00:00:01.000Z"),
      }),
    ).toEqual([]);
  });

  it("awards nothing for an unrelated topic inside the window", () => {
    expect(
      seasonalAwardsFor({
        topic: "TypeScript generics",
        gradedAt: new Date("2026-07-01T12:00:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("awards on the last possible instant", () => {
    expect(
      seasonalAwardsFor({
        topic: "fifa",
        gradedAt: new Date("2026-07-20T23:59:59.999Z"),
      }),
    ).toEqual(["fifa-2026"]);
  });
});

describe("openSeasons", () => {
  it("returns nothing long after every season", () => {
    expect(openSeasons(new Date("2030-01-01T00:00:00.000Z"))).toEqual([]);
  });
});

describe("SEASONAL_BADGES", () => {
  it("has unique ids", () => {
    const ids = SEASONAL_BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has windows that open before they close", () => {
    for (const badge of SEASONAL_BADGES) {
      expect(badge.closesAt.getTime()).toBeGreaterThan(badge.opensAt.getTime());
    }
  });

  it("has lowercase match terms, since the topic is lowercased before matching", () => {
    for (const badge of SEASONAL_BADGES) {
      for (const term of badge.topicMatches) {
        expect(term).toBe(term.toLowerCase());
      }
    }
  });

  it("is looked up by id", () => {
    expect(seasonalById("fifa-2026")?.name).toBe("World Cup 2026");
    expect(seasonalById("nope")).toBeUndefined();
  });
});
