import { Fragment } from "react";
import { type Token, type TokenKind, tokenize } from "@/lib/highlight";
import { cn } from "@/lib/utils";

/**
 * Renders question and answer text.
 *
 * The model writes code constantly for technical topics — fenced blocks and
 * `inline` spans — and rendering that as prose makes it unreadable. This is
 * deliberately not a markdown parser: we only trust the two constructs we
 * asked for, and everything else stays literal text. No HTML is ever
 * interpreted, so model output cannot inject markup.
 */
export function RichText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const blocks = splitFences(children);

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeBlock
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional and static
            key={i}
            code={block.text}
            lang={block.lang}
          />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional and static
          <p key={i} className="whitespace-pre-wrap text-pretty">
            {renderInline(block.text)}
          </p>
        ),
      )}
    </div>
  );
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  keyword: "text-syn-keyword",
  string: "text-syn-string",
  comment: "text-syn-comment italic",
  number: "text-syn-number",
  fn: "text-syn-fn",
  punct: "text-muted-foreground",
  plain: "",
};

/**
 * "What does this print?" is only a fair question if the code reads like code.
 * Highlighting is decorative: the snippet is fully legible with every token in
 * the default colour, which is what a forced-colours or print reader gets.
 */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const tokens: Token[] = tokenize(code, lang);

  return (
    <pre className="overflow-x-auto rounded-sm border bg-muted/50 p-3 font-mono text-[0.8125rem] leading-relaxed">
      <code>
        {tokens.map((token, i) => {
          const cls = TOKEN_CLASS[token.kind];
          return cls ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and static
            <span key={i} className={cls}>
              {token.text}
            </span>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and static
            <Fragment key={i}>{token.text}</Fragment>
          );
        })}
      </code>
    </pre>
  );
}

type Block =
  | { type: "text"; text: string; lang?: undefined }
  | { type: "code"; text: string; lang: string };

function splitFences(input: string): Block[] {
  const blocks: Block[] = [];
  // The language tag is captured, not discarded: it picks the keyword set.
  const fence = /```([a-zA-Z0-9+#-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  match = fence.exec(input);
  while (match !== null) {
    const before = input.slice(last, match.index).trim();
    if (before) blocks.push({ type: "text", text: before });

    const code = match[2]?.replace(/\n$/, "") ?? "";
    if (code.trim()) {
      blocks.push({ type: "code", text: code, lang: match[1] || "js" });
    }

    last = match.index + match[0].length;
    match = fence.exec(input);
  }

  const rest = input.slice(last).trim();
  if (rest) blocks.push({ type: "text", text: rest });

  // An unfenced prompt is the common case; never return nothing.
  return blocks.length ? blocks : [{ type: "text", text: input }];
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`\n]+`)/g);

  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code
        // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static
        key={i}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
