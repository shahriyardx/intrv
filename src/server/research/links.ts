import "server-only";

/**
 * Proving that a generated post's links exist.
 *
 * DeepSeek cannot browse. Every URL it writes comes out of training data, so a
 * meaningful share of them 404, redirect to a parked domain, or point at a page
 * that never said what it is cited for. Fabricated citations are exactly the
 * tell that makes writing read as machine-generated, and the one thing a reader
 * can catch us on — so nothing here trusts a model-supplied link. Every one is
 * fetched, and what does not answer is unwrapped to plain text.
 *
 * There is no search: posts are written from the topic and the model's own
 * knowledge. That keeps the pipeline to one external dependency and means a
 * post never waits on a search provider having a good minute.
 */

const VERIFY_TIMEOUT_MS = 6_000;
const MAX_VERIFY_CONCURRENCY = 6;

/** Content farms and answer-scraper mirrors. Citing these is worse than not. */
const BLOCKED_HOSTS = [
  "w3schools.com",
  "geeksforgeeks.org",
  "tutorialspoint.com",
  "javatpoint.com",
  "medium.com",
  "quora.com",
  "chegg.com",
  "coursehero.com",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAllowed(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return !BLOCKED_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

/**
 * Keep only the URLs that actually resolve.
 *
 * HEAD first because it is cheap, then GET for the many servers that answer 405
 * or 403 to HEAD but serve the page fine. A redirect is followed and the final
 * URL returned, so a citation never points at a stale path when the live one is
 * one hop away.
 */
export async function verifyUrls(urls: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter(isAllowed))];
  const resolved = new Map<string, string>();

  for (let i = 0; i < unique.length; i += MAX_VERIFY_CONCURRENCY) {
    const batch = unique.slice(i, i + MAX_VERIFY_CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (url) => {
        const final = await probe(url);
        return [url, final] as const;
      }),
    );
    for (const [url, final] of settled) {
      if (final) resolved.set(url, final);
    }
  }

  return resolved;
}

async function probe(url: string): Promise<string | null> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
        headers: {
          // A default fetch UA gets blocked by enough CDNs to produce false
          // negatives, which would silently strip good citations.
          "User-Agent":
            "Mozilla/5.0 (compatible; IntrvBot/1.0; +https://intrv.shahriyar.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (response.ok) return response.url || url;
      // 405/403 on HEAD is common and says nothing about the page; try GET.
      if (method === "HEAD") continue;
      return null;
    } catch {
      if (method === "GET") return null;
    }
  }
  return null;
}

/** Every markdown link target in a body, in document order. */
export function extractLinks(markdown: string): string[] {
  const links: string[] = [];
  const pattern = /\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
  let match = pattern.exec(markdown);
  while (match !== null) {
    links.push(match[1]);
    match = pattern.exec(markdown);
  }
  return links;
}

/**
 * Rewrite verified links to their resolved URL and unwrap the rest back to
 * plain text.
 *
 * Unwrapping rather than deleting: the sentence around a dead citation is
 * usually fine, and removing the text with it would leave a hole mid-argument.
 * The reader loses a link they could not have used anyway.
 */
export function applyLinkVerification(
  markdown: string,
  resolved: Map<string, string>,
): { body: string; kept: number; dropped: number } {
  let kept = 0;
  let dropped = 0;

  const body = markdown.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_full, text: string, url: string) => {
      const final = resolved.get(url);
      if (final) {
        kept++;
        return `[${text}](${final})`;
      }
      dropped++;
      return text;
    },
  );

  return { body, kept, dropped };
}
