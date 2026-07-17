import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, safeNextPath, signInPath } from "@/lib/next-path";

describe("safeNextPath", () => {
  it("keeps a plain absolute path", () => {
    expect(safeNextPath("/dashboard/review")).toBe("/dashboard/review");
  });

  it("keeps the query string, which is part of the destination", () => {
    expect(safeNextPath("/dashboard?tab=history")).toBe(
      "/dashboard?tab=history",
    );
  });

  it.each([undefined, null, ""])("falls back for %o", (input) => {
    expect(safeNextPath(input)).toBe(DEFAULT_REDIRECT);
  });

  it.each([
    ["https://evil.test", "an absolute URL"],
    ["javascript:alert(1)", "a scheme"],
    ["//evil.test", "protocol-relative"],
    ["/\\evil.test", "backslash protocol-relative"],
    ["dashboard", "a relative path"],
  ])("rejects %s (%s)", (input) => {
    expect(safeNextPath(input)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects a path that only becomes protocol-relative after the browser strips control characters", () => {
    // "/\t/evil.test" normalises to "//evil.test" during URL parsing, so the
    // strip has to happen before the decision, not after.
    expect(safeNextPath("/\t/evil.test")).toBe(DEFAULT_REDIRECT);
    expect(safeNextPath("/\n/evil.test")).toBe(DEFAULT_REDIRECT);
    expect(safeNextPath("/\r/evil.test")).toBe(DEFAULT_REDIRECT);
  });
});

describe("signInPath", () => {
  it("returns to the requested path", () => {
    expect(signInPath("/dashboard/review", "/dashboard")).toBe(
      "/sign-in?next=%2Fdashboard%2Freview",
    );
  });

  it("uses the fallback when proxy.ts stamped no path", () => {
    expect(signInPath(null, "/org")).toBe("/sign-in?next=%2Forg");
  });

  it("never forwards a spoofed x-pathname off-origin", () => {
    // The header is only trustworthy while proxy.ts sets it; if its matcher
    // ever stops covering a route, this is whatever the client sent.
    expect(signInPath("https://evil.test", "/dashboard")).toBe(
      `/sign-in?next=${encodeURIComponent(DEFAULT_REDIRECT)}`,
    );
    expect(signInPath("//evil.test", "/dashboard")).toBe(
      `/sign-in?next=${encodeURIComponent(DEFAULT_REDIRECT)}`,
    );
  });

  it("encodes the query string so it survives as one parameter", () => {
    expect(signInPath("/dashboard?tab=history&sort=asc", "/dashboard")).toBe(
      "/sign-in?next=%2Fdashboard%3Ftab%3Dhistory%26sort%3Dasc",
    );
  });
});
