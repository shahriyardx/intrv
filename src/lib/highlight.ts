/**
 * A small, dependency-free syntax tokenizer.
 *
 * Why not Shiki: the question runner streams questions into a Client Component,
 * so a real grammar-based highlighter would either ship its engine and grammars
 * to every page or force us to send pre-rendered HTML through
 * dangerouslySetInnerHTML. Both are a bad trade for the short snippets that
 * appear in a quiz question. This runs identically on the server and the client,
 * costs nothing, and never produces markup — only tokens the renderer maps to
 * spans, so model output still cannot inject anything.
 *
 * It is approximate by construction: regex is not a parser. It is tuned to look
 * right on idiomatic snippets, and its failure mode is a word painted the wrong
 * colour, never a crash or a wrong character.
 */

export type TokenKind =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "fn"
  | "punct"
  | "plain";

export type Token = { text: string; kind: TokenKind };

const KEYWORDS: Record<string, string[]> = {
  js: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "break",
    "continue",
    "new",
    "class",
    "extends",
    "super",
    "this",
    "typeof",
    "instanceof",
    "in",
    "of",
    "async",
    "await",
    "try",
    "catch",
    "finally",
    "throw",
    "switch",
    "case",
    "default",
    "delete",
    "void",
    "yield",
    "import",
    "export",
    "from",
    "as",
    "static",
    "get",
    "set",
    "null",
    "undefined",
    "true",
    "false",
    "NaN",
  ],
  ts: [
    "interface",
    "type",
    "enum",
    "implements",
    "public",
    "private",
    "protected",
    "readonly",
    "namespace",
    "declare",
    "abstract",
    "satisfies",
    "keyof",
    "infer",
    "never",
    "unknown",
    "any",
    "string",
    "number",
    "boolean",
    "object",
    "symbol",
    "bigint",
  ],
  py: [
    "def",
    "class",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "break",
    "continue",
    "import",
    "from",
    "as",
    "try",
    "except",
    "finally",
    "raise",
    "with",
    "lambda",
    "yield",
    "global",
    "nonlocal",
    "pass",
    "and",
    "or",
    "not",
    "in",
    "is",
    "None",
    "True",
    "False",
    "async",
    "await",
    "self",
  ],
  sql: [
    "select",
    "from",
    "where",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "on",
    "group",
    "by",
    "order",
    "having",
    "limit",
    "offset",
    "insert",
    "into",
    "values",
    "update",
    "set",
    "delete",
    "create",
    "table",
    "alter",
    "drop",
    "index",
    "primary",
    "key",
    "foreign",
    "references",
    "and",
    "or",
    "not",
    "null",
    "as",
    "distinct",
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "case",
    "when",
    "then",
    "end",
    "union",
    "all",
    "with",
  ],
  css: ["important", "media", "supports", "keyframes", "import", "root"],
};

/** Which keyword sets apply, by fence language. Unknown languages get JS. */
function keywordsFor(lang: string): Set<string> {
  const l = lang.toLowerCase();
  if (l === "py" || l === "python") return new Set(KEYWORDS.py);
  if (l === "sql" || l === "postgres" || l === "postgresql")
    return new Set(KEYWORDS.sql);
  if (l === "css" || l === "scss") return new Set([...KEYWORDS.css]);
  if (l === "html" || l === "xml" || l === "svg") return new Set();
  if (l === "json") return new Set(["true", "false", "null"]);
  if (l === "ts" || l === "tsx" || l === "typescript") {
    return new Set([...KEYWORDS.js, ...KEYWORDS.ts]);
  }
  return new Set(KEYWORDS.js);
}

/** Line-comment opener by language. */
function lineComment(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "py" || l === "python" || l === "sh" || l === "bash") return "#";
  if (l === "sql" || l === "postgres" || l === "postgresql") return "--";
  return "//";
}

// One pass, ordered: whatever matches first at a position wins, so a keyword
// inside a string stays a string.
const PATTERNS: { kind: TokenKind; re: RegExp }[] = [
  {
    kind: "string",
    re: /^(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/,
  },
  {
    kind: "number",
    re: /^\b(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/,
  },
  { kind: "plain", re: /^[A-Za-z_$][\w$]*/ },
  { kind: "punct", re: /^[{}()[\];:,.<>+\-*/%=!&|?~^]+/ },
  { kind: "plain", re: /^\s+/ },
  { kind: "plain", re: /^[^\s\w]/ },
];

export function tokenize(code: string, lang = "js"): Token[] {
  const keywords = keywordsFor(lang);
  const comment = lineComment(lang);
  const tokens: Token[] = [];
  let rest = code;

  const push = (text: string, kind: TokenKind) => {
    if (!text) return;
    const last = tokens.at(-1);
    // Merging runs keeps the DOM small on a long snippet.
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  };

  while (rest.length > 0) {
    // Comments first: they swallow everything else to end of line.
    if (rest.startsWith(comment)) {
      const end = rest.indexOf("\n");
      const text = end === -1 ? rest : rest.slice(0, end);
      push(text, "comment");
      rest = end === -1 ? "" : rest.slice(end);
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      const text = end === -1 ? rest : rest.slice(0, end + 2);
      push(text, "comment");
      rest = end === -1 ? "" : rest.slice(end + 2);
      continue;
    }

    let matched = false;
    for (const { kind, re } of PATTERNS) {
      const m = re.exec(rest);
      if (!m) continue;

      const text = m[0];
      let actual = kind;

      if (kind === "plain" && /^[A-Za-z_$]/.test(text)) {
        if (keywords.has(text) || keywords.has(text.toLowerCase())) {
          actual = "keyword";
        } else if (rest[text.length] === "(") {
          actual = "fn";
        }
      }

      push(text, actual);
      rest = rest.slice(text.length);
      matched = true;
      break;
    }

    // Nothing matched: consume a character so this can never spin.
    if (!matched) {
      push(rest[0] ?? "", "plain");
      rest = rest.slice(1);
    }
  }

  return tokens;
}
