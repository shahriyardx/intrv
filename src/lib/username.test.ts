import { describe, expect, it } from "vitest";
import {
  generateUsername,
  isValidUsername,
  USERNAME_MAX,
  usernameProblem,
} from "@/lib/username";

describe("usernameProblem", () => {
  it("accepts a normal handle", () => {
    expect(usernameProblem("swift-otter-4821")).toBeNull();
    expect(isValidUsername("cobalt99")).toBe(true);
  });

  it("rejects too short and too long", () => {
    expect(usernameProblem("abc")).toBe("too-short");
    expect(usernameProblem("a".repeat(USERNAME_MAX + 1))).toBe("too-long");
  });

  it("normalizes case rather than rejecting it (the plugin lowercases too)", () => {
    expect(usernameProblem("Swift-Otter")).toBeNull();
  });

  it("rejects illegal shapes", () => {
    expect(usernameProblem("space bar")).toBe("shape");
    expect(usernameProblem("under_score")).toBe("shape");
    expect(usernameProblem("-leading")).toBe("shape");
    expect(usernameProblem("trailing-")).toBe("shape");
    expect(usernameProblem("double--hyphen")).toBe("shape");
  });

  it("rejects reserved names, case-insensitively", () => {
    expect(usernameProblem("admin")).toBe("reserved");
    expect(usernameProblem("ADMIN")).toBe("reserved");
    expect(usernameProblem("leaderboard")).toBe("reserved");
    expect(usernameProblem("intrv")).toBe("reserved");
  });
});

describe("generateUsername", () => {
  it("always produces a valid username", () => {
    // Sweep the injectable RNG across its range to hit every word/number combo
    // boundary; every result must satisfy the same rules the validator enforces.
    for (let i = 0; i < 200; i++) {
      const r = i / 200;
      const name = generateUsername(() => r);
      expect(isValidUsername(name)).toBe(true);
      expect(name.length).toBeLessThanOrEqual(USERNAME_MAX);
    }
  });

  it("is deterministic under a fixed RNG", () => {
    expect(generateUsername(() => 0)).toBe(`${"swift"}-${"otter"}-0000`);
  });
});
