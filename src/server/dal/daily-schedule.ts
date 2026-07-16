/**
 * Pure scheduling logic for the daily challenge. Deliberately import-free — no
 * database, no `server-only`, no environment — so the date key and topic
 * rotation are unit-testable in isolation, the same reason owner.ts stays pure.
 *
 * The daily challenge is keyed by UTC day: everyone in the world plays the same
 * set, and it turns over at 00:00 UTC regardless of where the visitor is.
 */

/**
 * A fixed rotation of well-known developer topics. Order is load-bearing: the
 * topic for a given day is chosen by hashing its date key into this list, so
 * reordering or trimming it silently reassigns which day gets which topic.
 */
export const DAILY_TOPICS = [
  "JavaScript",
  "CSS",
  "SQL",
  "React",
  "TypeScript",
  "HTTP & networking",
  "Git",
  "Data structures",
  "Algorithms",
  "Node.js",
  "Python",
  "Docker",
  "Testing",
  "Web accessibility",
] as const;

/**
 * The UTC calendar day as `YYYY-MM-DD`.
 *
 * UTC on purpose, and computed by hand rather than via `toISOString().slice()`
 * so the intent is explicit: the key must not drift with the server's local
 * timezone, or two servers in different zones would disagree about which day it
 * is near midnight and split the shared challenge in two.
 */
export function dateKeyUTC(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Deterministic index into DAILY_TOPICS for a date key.
 *
 * A plain djb2-style rolling hash kept in int32 range (`| 0`) — no BigInt, which
 * this tsconfig target cannot express. The double modulo normalises the sign,
 * since `| 0` can go negative.
 */
export function dailyTopicIndex(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) | 0;
  }
  const len = DAILY_TOPICS.length;
  return ((hash % len) + len) % len;
}

/** The topic assigned to a given UTC day. */
export function dailyTopicFor(dateKey: string): string {
  return DAILY_TOPICS[dailyTopicIndex(dateKey)];
}
