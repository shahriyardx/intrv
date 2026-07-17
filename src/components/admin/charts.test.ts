import { describe, expect, it } from "vitest";
import { barWidth } from "@/components/admin/charts";

describe("barWidth", () => {
  it("draws nothing for zero", () => {
    // The bug this pins: a 1% floor applied to every row painted a sliver for
    // empty score bands, so "0 candidates" looked like a few.
    expect(barWidth(0, 12)).toBe("0%");
  });

  it("draws nothing when every row is zero", () => {
    expect(barWidth(0, 0)).toBe("0%");
  });

  it("fills the full track at the max", () => {
    expect(barWidth(12, 12)).toBe("100%");
  });

  it("scales in between", () => {
    expect(barWidth(3, 12)).toBe("25%");
  });

  it("keeps a real-but-tiny value visible at the 1% floor", () => {
    expect(barWidth(0.002, 12)).toBe("1%");
  });

  it("never returns a negative width", () => {
    expect(barWidth(-5, 12)).toBe("0%");
  });
});
