import { describe, expect, it } from "vitest";
import { JD_MAX, JD_MIN, jdTextSchema, mapSeniority } from "@/lib/jd";

describe("mapSeniority", () => {
  it("maps the five canonical levels", () => {
    expect(mapSeniority("intern")).toBe("BEGINNER");
    expect(mapSeniority("junior")).toBe("EASY");
    expect(mapSeniority("mid")).toBe("MEDIUM");
    expect(mapSeniority("senior")).toBe("HARD");
    expect(mapSeniority("staff")).toBe("EXPERT");
    expect(mapSeniority("principal")).toBe("EXPERT");
  });

  it("lets staff/principal win over the 'senior' substring", () => {
    // "senior staff engineer" must not collapse to HARD.
    expect(mapSeniority("senior staff engineer")).toBe("EXPERT");
    expect(mapSeniority("Senior Principal")).toBe("EXPERT");
  });

  it("is case-insensitive and reads common synonyms", () => {
    expect(mapSeniority("SENIOR")).toBe("HARD");
    expect(mapSeniority("new grad")).toBe("EASY");
    expect(mapSeniority("Trainee")).toBe("BEGINNER");
    expect(mapSeniority("intermediate")).toBe("MEDIUM");
  });

  it("holds at MEDIUM for anything unrecognized", () => {
    expect(mapSeniority("wizard")).toBe("MEDIUM");
    expect(mapSeniority("")).toBe("MEDIUM");
  });
});

describe("jdTextSchema", () => {
  const validJd = "a".repeat(JD_MIN + 10);

  it("accepts a description at or over the minimum", () => {
    expect(jdTextSchema.safeParse(validJd).success).toBe(true);
  });

  it("rejects too-short text after trimming", () => {
    expect(jdTextSchema.safeParse("   short   ").success).toBe(false);
  });

  it("rejects text past the maximum", () => {
    expect(jdTextSchema.safeParse("a".repeat(JD_MAX + 1)).success).toBe(false);
  });

  it("strips control characters but keeps newlines and tabs", () => {
    const bell = String.fromCharCode(7);
    // The bell should vanish; the tab and newline must survive.
    const raw = `Line one\twith tab\nLine two${bell}${"x".repeat(JD_MIN)}`;
    const out = jdTextSchema.safeParse(raw);
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data).not.toContain(bell);
      expect(out.data).toContain("\n");
      expect(out.data).toContain("\t");
    }
  });

  it("counts length on the cleaned text, so control-byte padding cannot fake the minimum", () => {
    const nul = String.fromCharCode(0);
    // 40 real chars + 60 NUL bytes: cleaned length is 40, under JD_MIN.
    const padded = "real content here that is forty chars ok" + nul.repeat(60);
    expect(padded.length).toBeGreaterThanOrEqual(JD_MIN);
    expect(jdTextSchema.safeParse(padded).success).toBe(false);
  });
});
