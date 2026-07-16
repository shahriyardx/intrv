import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders post Markdown, which is authored in /admin and displayed on a public
 * page. That makes stored XSS the failure mode this component exists to prevent.
 *
 * DO NOT add `rehype-raw`, `remark-rehype`'s `allowDangerousHtml`, or a
 * `dangerouslySetInnerHTML` component override to this file. react-markdown
 * does not render raw HTML embedded in Markdown unless you opt in, and that
 * default is the whole defence: `<script>alert(1)</script>` in a body must come
 * out as visible text, not as a script tag. Anything that "fixes" an author's
 * inline HTML not working reopens the hole.
 *
 * No "use client": this is a universal component. It renders on the server for
 * the public post page, and inside the client bundle for the editor's live
 * preview, and both must go through this exact pipeline — a preview that
 * rendered more than the real page would hide the difference from the author.
 */

/**
 * Narrower than react-markdown's `defaultUrlTransform`, which also permits
 * `irc:`, `ircs:` and `xmpp:`. A blog post has no use for those, and the set of
 * schemes we hand a visitor's browser should be the set we actually want.
 * Everything else — `javascript:`, `data:`, `vbscript:` — collapses to an empty
 * URL rather than an attribute a click can execute.
 */
const SAFE_SCHEME = /^(?:https?|mailto)$/i;

function safeUrl(url: string): string {
  // Browsers ignore control characters and whitespace when resolving a scheme,
  // so "java\tscript:alert(1)" would run. Detection therefore happens on a
  // stripped copy, while the original is what gets returned.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters IS the check — they are the evasion
  const probe = url.replace(/[\u0000-\u0020]/g, "");

  const colon = probe.indexOf(":");
  const slash = probe.indexOf("/");
  const question = probe.indexOf("?");
  const hash = probe.indexOf("#");

  // A colon only introduces a scheme if it comes before any `/`, `?` or `#`.
  // Without these checks a relative "notes/a:b" would read as scheme "notes/a".
  const isRelative =
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (question !== -1 && colon > question) ||
    (hash !== -1 && colon > hash);

  if (isRelative) return url;
  return SAFE_SCHEME.test(probe.slice(0, colon)) ? url : "";
}

/**
 * `node` is react-markdown's hast node. It is destructured out of every
 * override below because spreading it onto a DOM element makes React warn about
 * an unknown attribute.
 */
const components: Components = {
  h1: ({ node, className, ...props }) => (
    <h2
      className={cn(
        // An h1 in a body would compete with the post title, which is the page's
        // real h1. Demoted a level so the document outline stays truthful.
        "mt-12 mb-4 font-display text-display-md text-balance first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ node, className, ...props }) => (
    <h2
      className={cn(
        "mt-12 mb-4 font-display text-display-md text-balance first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ node, className, ...props }) => (
    <h3
      className={cn(
        "mt-10 mb-3 font-display text-xl text-balance first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ node, className, ...props }) => (
    <h4
      className={cn(
        "mt-8 mb-2 font-display text-lg text-balance first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ node, className, ...props }) => (
    <p
      className={cn("my-5 text-pretty leading-[1.75]", className)}
      {...props}
    />
  ),
  a: ({ node, className, ...props }) => (
    <a
      className={cn(
        "underline decoration-border underline-offset-[3px] transition-colors hover:decoration-foreground",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ node, className, ...props }) => (
    <ul
      className={cn(
        "my-5 list-disc space-y-2 pl-6 marker:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ node, className, ...props }) => (
    <ol
      className={cn(
        "my-5 list-decimal space-y-2 pl-6 marker:font-mono marker:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  li: ({ node, className, ...props }) => (
    <li className={cn("leading-[1.75] pl-1", className)} {...props} />
  ),
  blockquote: ({ node, className, ...props }) => (
    <blockquote
      className={cn(
        "my-6 border-l-2 pl-5 font-display text-lg italic text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ node, className, ...props }) => (
    <hr className={cn("my-12 border-t", className)} {...props} />
  ),
  strong: ({ node, className, ...props }) => (
    <strong className={cn("font-semibold", className)} {...props} />
  ),
  code: ({ node, className, ...props }) => (
    // Inline chrome. Fenced blocks get the same element inside a <pre>, where
    // the wrapper's `[&_pre_code]` rules below strip this back off.
    <code
      className={cn(
        "rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em]",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ node, className, ...props }) => (
    <pre
      className={cn(
        // A long line must scroll inside the block, never widen the page.
        "my-6 overflow-x-auto rounded-md border bg-muted p-4 font-mono text-sm leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
  // GFM tables. The scroll container is the table's own, so a wide table
  // scrolls sideways by itself instead of forcing the article to.
  table: ({ node, className, ...props }) => (
    <div className="my-6 overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  ),
  th: ({ node, className, ...props }) => (
    <th
      className={cn(
        "border-b px-3 py-2 text-left font-mono text-[0.6875rem] uppercase tracking-[0.08em] font-normal text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node, className, ...props }) => (
    <td className={cn("border-b px-3 py-2 align-top", className)} {...props} />
  ),
  img: ({ node, className, ...props }) => (
    // alt="" is a default, not a decision: react-markdown passes the author's
    // own alt text through `props`, which is spread after and therefore wins.
    //
    // Not next/image: the source is author-written Markdown with no known
    // dimensions and no allow-listed remote host.
    // biome-ignore lint/performance/noImgElement: author Markdown has no known dimensions
    <img
      alt=""
      className={cn("my-6 h-auto max-w-full rounded-md border", className)}
      {...props}
    />
  ),
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[0.9375rem] leading-relaxed",
        // Fenced code: <pre> owns the block's chrome, so the <code> inside it
        // sheds the inline pill styling above.
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[1em]",
        className,
      )}
    >
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
