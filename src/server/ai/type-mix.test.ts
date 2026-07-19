import { describe, expect, it } from "vitest";
import { planTypeMix, type QuestionType, targetCounts } from "./type-mix";

const ALL: QuestionType[] = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER"];

/** Deterministic sequence so a failure is reproducible. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function tally(plan: QuestionType[]): Record<QuestionType, number> {
  const counts: Record<QuestionType, number> = {
    MCQ: 0,
    TRUE_FALSE: 0,
    SHORT_ANSWER: 0,
  };
  for (const type of plan) counts[type]++;
  return counts;
}

describe("targetCounts", () => {
  it("allocates exactly the requested number", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const count of [5, 10, 20]) {
        const counts = targetCounts(ALL, count, seeded(seed));
        const total = counts.MCQ + counts.TRUE_FALSE + counts.SHORT_ANSWER;
        expect(total).toBe(count);
      }
    }
  });

  // The complaint that started this: a third of every set was true/false.
  it("keeps true/false at or under a quarter of a mixed set", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const counts = targetCounts(ALL, 20, seeded(seed));
      expect(counts.TRUE_FALSE / 20).toBeLessThanOrEqual(0.25);
    }
  });

  it("always makes MCQ the most common type in a mixed set", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const counts = targetCounts(ALL, 20, seeded(seed));
      expect(counts.MCQ).toBeGreaterThan(counts.TRUE_FALSE);
      expect(counts.MCQ).toBeGreaterThan(counts.SHORT_ANSWER);
    }
  });

  it("varies the mix between generations", () => {
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const c = targetCounts(ALL, 20, seeded(seed));
      shapes.add(`${c.MCQ}/${c.TRUE_FALSE}/${c.SHORT_ANSWER}`);
    }
    // A fixed ratio would collapse to one shape; this must not.
    expect(shapes.size).toBeGreaterThan(3);
  });

  it("gives the whole set to a single selected type", () => {
    expect(targetCounts(["TRUE_FALSE"], 12, seeded(7))).toEqual({
      MCQ: 0,
      TRUE_FALSE: 12,
      SHORT_ANSWER: 0,
    });
  });

  // "if only true false / short is selected that's a different story" — both
  // the true/false ceiling and the MCQ lead exist to stop true/false crowding
  // out MCQ, so neither applies when MCQ was not chosen.
  it("splits a true/false + short-answer set between just those two", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const counts = targetCounts(
        ["TRUE_FALSE", "SHORT_ANSWER"],
        10,
        seeded(seed),
      );
      expect(counts.MCQ).toBe(0);
      expect(counts.TRUE_FALSE + counts.SHORT_ANSWER).toBe(10);
      expect(counts.TRUE_FALSE).toBeGreaterThan(0);
      expect(counts.SHORT_ANSWER).toBeGreaterThan(0);
    }
  });

  it("lets true/false past its ceiling when MCQ is not on the table", () => {
    // Capped at 25% it would never clear a third of the set; unclamped it
    // should reach roughly its fair share against one other type.
    const shares: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const counts = targetCounts(
        ["TRUE_FALSE", "SHORT_ANSWER"],
        20,
        seeded(seed),
      );
      shares.push(counts.TRUE_FALSE / 20);
    }
    expect(Math.max(...shares)).toBeGreaterThan(0.3);
  });

  it("represents every selected type when the set is big enough", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const counts = targetCounts(ALL, 5, seeded(seed));
      expect(counts.MCQ).toBeGreaterThan(0);
      expect(counts.TRUE_FALSE).toBeGreaterThan(0);
      expect(counts.SHORT_ANSWER).toBeGreaterThan(0);
    }
  });

  it("survives degenerate input", () => {
    expect(targetCounts([], 10, seeded(1))).toEqual({
      MCQ: 0,
      TRUE_FALSE: 0,
      SHORT_ANSWER: 0,
    });
    const zero = targetCounts(ALL, 0, seeded(1));
    expect(zero.MCQ + zero.TRUE_FALSE + zero.SHORT_ANSWER).toBe(0);
  });

  it("ignores duplicates in the selected list", () => {
    const counts = targetCounts(["MCQ", "MCQ", "MCQ"], 6, seeded(3));
    expect(counts).toEqual({ MCQ: 6, TRUE_FALSE: 0, SHORT_ANSWER: 0 });
  });
});

describe("planTypeMix", () => {
  it("returns one entry per question, matching the target counts", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rand = seeded(seed);
      const plan = planTypeMix(ALL, 20, rand);
      expect(plan).toHaveLength(20);
      const counts = tally(plan);
      expect(counts.MCQ + counts.TRUE_FALSE + counts.SHORT_ANSWER).toBe(20);
      expect(counts.MCQ).toBeGreaterThan(counts.TRUE_FALSE);
    }
  });

  // The actual bug: MCQ → T/F → SHORT → MCQ → T/F → SHORT forever.
  it("does not produce a repeating cycle", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planTypeMix(ALL, 12, seeded(seed));
      const cycles = plan.every((type, i) => i < 3 || type === plan[i - 3]);
      expect(cycles).toBe(false);
    }
  });

  it("never runs one type more than three deep", () => {
    for (let seed = 1; seed <= 80; seed++) {
      const plan = planTypeMix(ALL, 20, seeded(seed));
      let run = 1;
      for (let i = 1; i < plan.length; i++) {
        run = plan[i] === plan[i - 1] ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(3);
      }
    }
  });

  it("orders differently across generations", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      orders.add(planTypeMix(ALL, 12, seeded(seed)).join(","));
    }
    expect(orders.size).toBeGreaterThan(20);
  });

  it("handles a single-type set without trying to break runs", () => {
    const plan = planTypeMix(["MCQ"], 8, seeded(5));
    expect(plan).toEqual(Array(8).fill("MCQ"));
  });

  it("handles counts smaller than the number of types", () => {
    const plan = planTypeMix(ALL, 2, seeded(9));
    expect(plan).toHaveLength(2);
  });
});
