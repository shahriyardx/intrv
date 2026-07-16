import { Fragment } from "react";
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
          <pre
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional and static
            key={i}
            className="overflow-x-auto rounded-md border bg-muted/60 p-3 font-mono text-[0.8125rem] leading-relaxed"
          >
            <code>{block.text}</code>
          </pre>
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

type Block = { type: "text" | "code"; text: string };

function splitFences(input: string): Block[] {
  const blocks: Block[] = [];
  const fence = /```[a-zA-Z0-9]*\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  match = fence.exec(input);
  while (match !== null) {
    const before = input.slice(last, match.index).trim();
    if (before) blocks.push({ type: "text", text: before });

    const code = match[1]?.replace(/\n$/, "") ?? "";
    if (code.trim()) blocks.push({ type: "code", text: code });

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
