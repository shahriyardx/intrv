import { describe, expect, it } from "vitest";
import { applyLinkVerification, extractLinks } from "./links";

/**
 * The pure half of link verification. The network half (verifyUrls) is
 * exercised against the real web by hand — these cover the parsing and
 * rewriting, which is where a silent bug would quietly mangle a published
 * post.
 */

describe("extractLinks", () => {
  it("finds http(s) link targets in document order", () => {
    const md = "See [a](https://a.example/x) and [b](http://b.example/y).";
    expect(extractLinks(md)).toEqual([
      "https://a.example/x",
      "http://b.example/y",
    ]);
  });

  it("ignores relative and non-http targets", () => {
    const md =
      "[rel](/about) [mail](mailto:a@b.c) [js](javascript:alert(1)) [ok](https://a.example)";
    expect(extractLinks(md)).toEqual(["https://a.example"]);
  });

  it("returns an empty list for prose with no links", () => {
    expect(
      extractLinks("Just words, and a bare https://a.example URL."),
    ).toEqual([]);
  });

  it("handles an empty link text", () => {
    expect(extractLinks("[](https://a.example)")).toEqual([
      "https://a.example",
    ]);
  });

  it("does not run away on a malformed link", () => {
    expect(extractLinks("[unclosed](https://a.example")).toEqual([]);
  });
});

describe("applyLinkVerification", () => {
  it("rewrites a verified link to its resolved URL", () => {
    const md = "See [docs](https://a.example/old).";
    const resolved = new Map([
      ["https://a.example/old", "https://a.example/new"],
    ]);
    const out = applyLinkVerification(md, resolved);

    expect(out.body).toBe("See [docs](https://a.example/new).");
    expect(out.kept).toBe(1);
    expect(out.dropped).toBe(0);
  });

  // Unwrapping, not deleting: the sentence around a dead citation is usually
  // fine, and removing the text with it would leave a hole mid-argument.
  it("unwraps an unverified link to its text, keeping the sentence", () => {
    const md = "Read [the spec](https://gone.example/404) before answering.";
    const out = applyLinkVerification(md, new Map());

    expect(out.body).toBe("Read the spec before answering.");
    expect(out.kept).toBe(0);
    expect(out.dropped).toBe(1);
  });

  it("counts a mixed body correctly", () => {
    const md =
      "[a](https://a.example) [b](https://b.example) [c](https://c.example)";
    const resolved = new Map([
      ["https://a.example", "https://a.example"],
      ["https://c.example", "https://c.example"],
    ]);
    const out = applyLinkVerification(md, resolved);

    expect(out.kept).toBe(2);
    expect(out.dropped).toBe(1);
    expect(out.body).toBe("[a](https://a.example) b [c](https://c.example)");
  });

  it("leaves prose without links untouched", () => {
    const md = "# Heading\n\nA paragraph with `code` and *emphasis*.";
    const out = applyLinkVerification(md, new Map());

    expect(out.body).toBe(md);
    expect(out.kept).toBe(0);
    expect(out.dropped).toBe(0);
  });

  it("does not touch image syntax", () => {
    // ![alt](url) would lose its bang and become a link if the pattern were
    // careless about the preceding character.
    const md = "![alt](https://a.example/img.png)";
    const out = applyLinkVerification(md, new Map());
    expect(out.body).toBe("!alt");
  });

  it("handles the same URL cited twice", () => {
    const md = "[one](https://a.example) and [two](https://a.example)";
    const resolved = new Map([["https://a.example", "https://a.example"]]);
    const out = applyLinkVerification(md, resolved);

    expect(out.kept).toBe(2);
    expect(out.body).toBe(
      "[one](https://a.example) and [two](https://a.example)",
    );
  });
});
