import { describe, expect, it } from "vitest";
import { type TokenKind, tokenize } from "@/lib/highlight";

/** The text must survive exactly — highlighting may never alter the code. */
function roundTrip(code: string, lang?: string) {
  return tokenize(code, lang)
    .map((t) => t.text)
    .join("");
}

function kindOf(code: string, needle: string, lang?: string): TokenKind | null {
  return tokenize(code, lang).find((t) => t.text === needle)?.kind ?? null;
}

describe("tokenize", () => {
  it("never changes the code it highlights", () => {
    const code = `const x = "a\\"b"; // note\nfoo(1.5e3, \`t\${x}\`)`;
    expect(roundTrip(code)).toBe(code);
  });

  it("survives an empty string and whitespace", () => {
    expect(roundTrip("")).toBe("");
    expect(roundTrip("\n\n  ")).toBe("\n\n  ");
  });

  it("marks keywords, calls, numbers and strings", () => {
    const code = 'const n = 42; greet("hi")';
    expect(kindOf(code, "const")).toBe("keyword");
    expect(kindOf(code, "42")).toBe("number");
    expect(kindOf(code, '"hi"')).toBe("string");
    expect(kindOf(code, "greet")).toBe("fn");
  });

  it("does not colour a keyword that lives inside a string", () => {
    // The whole literal is one string token, so "const" never appears alone.
    const tokens = tokenize('x = "const function return"');
    expect(tokens.some((t) => t.kind === "keyword" && t.text === "const")).toBe(
      false,
    );
    expect(tokens.some((t) => t.text === '"const function return"')).toBe(true);
  });

  it("takes comments to end of line, keywords and all", () => {
    const tokens = tokenize("a = 1 // const foo() 42\nb = 2");
    const comment = tokens.find((t) => t.kind === "comment");
    expect(comment?.text).toBe("// const foo() 42");
    // The line after the comment is still live code.
    expect(tokens.some((t) => t.text === "2" && t.kind === "number")).toBe(
      true,
    );
  });

  it("handles a block comment and an unterminated one", () => {
    expect(kindOf("/* hi */ x", "/* hi */")).toBe("comment");
    expect(roundTrip("/* never closed")).toBe("/* never closed");
  });

  it("uses # for python and -- for sql", () => {
    expect(kindOf("x = 1 # note", "# note", "python")).toBe("comment");
    expect(kindOf("select 1 -- note", "-- note", "sql")).toBe("comment");
    // A JS-style comment is not a comment in SQL.
    expect(kindOf("select 1 // note", "// note", "sql")).toBeNull();
  });

  it("knows language-specific keywords", () => {
    expect(kindOf("def f():", "def", "python")).toBe("keyword");
    expect(kindOf("interface X {}", "interface", "ts")).toBe("keyword");

    // `interface` is not a JavaScript keyword. Asserted as "no keyword token"
    // rather than by looking it up: adjacent plain runs merge, so in JS it is
    // part of a larger "interface X " token by design.
    const asJs = tokenize("interface X {}", "js");
    expect(asJs.some((t) => t.kind === "keyword")).toBe(false);
  });

  it("matches SQL keywords case-insensitively", () => {
    expect(kindOf("SELECT * FROM t", "SELECT", "sql")).toBe("keyword");
    expect(kindOf("select * from t", "select", "sql")).toBe("keyword");
  });

  it("terminates on unmatched exotic characters", () => {
    // The failure mode to avoid is an infinite loop, not a wrong colour.
    const code = "const emoji = '🙂'; x ?? y";
    expect(roundTrip(code)).toBe(code);
  });
});
