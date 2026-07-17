import { describe, expect, it } from "vitest";
import {
  beatsShare,
  bucketScores,
  median,
  percentile,
  verdictFor,
} from "@/server/dal/org-stats";

describe("median", () => {
  it("averages the middle pair on an even count", () => {
    expect(median([12, 33, 48, 55, 64, 71, 78, 92])).toBe(59.5);
  });

  it("takes the middle value on an odd count", () => {
    expect(median([10, 20, 90])).toBe(20);
  });

  it("is order-independent", () => {
    expect(median([92, 12, 55])).toBe(55);
  });

  it("returns null rather than NaN for an empty cohort", () => {
    // An assessment with no graded attempts must render an em dash, not NaN%.
    expect(median([])).toBeNull();
  });
});

describe("percentile", () => {
  const sorted = [12, 33, 48, 55, 64, 71, 78, 92];

  it("uses nearest rank", () => {
    expect(percentile(sorted, 25)).toBe(33);
    expect(percentile(sorted, 75)).toBe(71);
  });

  it("clamps the ends instead of running off the array", () => {
    expect(percentile(sorted, 0)).toBe(12);
    expect(percentile(sorted, 100)).toBe(92);
  });

  it("returns null for an empty cohort", () => {
    expect(percentile([], 50)).toBeNull();
  });
});

describe("bucketScores", () => {
  it("puts every score in exactly one band", () => {
    const buckets = bucketScores([12, 33, 48, 55, 64, 71, 78, 92]);
    expect(buckets.map((b) => b.count)).toEqual([1, 1, 2, 3, 1]);
  });

  it("counts a perfect 100 rather than dropping it off the end", () => {
    // The top band is half-open like the others, so 100 needs the extra room.
    const buckets = bucketScores([100]);
    expect(buckets.at(-1)?.count).toBe(1);
  });

  it("puts a boundary score in the upper band", () => {
    expect(bucketScores([80]).at(-1)?.count).toBe(1);
    expect(bucketScores([80])[3]?.count).toBe(0);
  });

  it("handles a zero", () => {
    expect(bucketScores([0])[0]?.count).toBe(1);
  });
});

describe("verdictFor", () => {
  it("withholds a verdict under a usable sample", () => {
    // Two of three candidates failing says nothing about the question, and
    // saying it does sends someone off to rewrite a good one.
    expect(verdictFor(1, 3)).toBe("insufficient");
    expect(verdictFor(4, 4)).toBe("insufficient");
  });

  it("flags a question nearly everyone passes as carrying no signal", () => {
    expect(verdictFor(8, 8)).toBe("no-signal");
    expect(verdictFor(9, 10)).toBe("no-signal");
  });

  it("flags a question nearly nobody passes", () => {
    expect(verdictFor(0, 8)).toBe("too-hard");
    expect(verdictFor(1, 10)).toBe("too-hard");
  });

  it("calls the middle ground discriminating", () => {
    expect(verdictFor(4, 8)).toBe("discriminates");
    expect(verdictFor(2, 10)).toBe("discriminates");
  });

  it("treats zero answers as insufficient rather than dividing by zero", () => {
    expect(verdictFor(0, 0)).toBe("insufficient");
  });
});

describe("beatsShare", () => {
  const cohort = [12, 33, 48, 55, 64, 71, 78, 92];

  it("reports the share strictly beaten", () => {
    expect(beatsShare(92, cohort)).toBe(88); // 7 of 8
    expect(beatsShare(12, cohort)).toBe(0); // beats nobody
  });

  it("does not credit a tie", () => {
    // Two candidates on 50 each beat only the one below them, not each other.
    expect(beatsShare(50, [50, 50, 10])).toBe(33);
  });

  it("returns 0 for an empty cohort rather than dividing by zero", () => {
    expect(beatsShare(50, [])).toBe(0);
  });
});
