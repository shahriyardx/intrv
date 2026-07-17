/**
 * Username rules, shared by the better-auth username plugin's validator, the
 * settings form's zod schema, and the random-username generator. One source of
 * truth so the three can never disagree about what a legal username is.
 *
 * Import-free (like owner.ts and next-path.ts) so it stays unit-testable and can
 * be pulled into both client forms and server code without dragging anything in.
 */

export const USERNAME_MIN = 5;
export const USERNAME_MAX = 20;

/**
 * Lowercase letters, digits, single internal hyphens. No leading/trailing or
 * doubled hyphen — so "a--b", "-ab", "ab-" are out. The plugin normalizes to
 * lowercase before this runs, but we reject uppercase explicitly too so the
 * settings form gives the same answer the server will.
 */
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names that would collide with a route segment or impersonate the product or
 * staff. Checked lowercased. Kept deliberately broad — a username is cheap, a
 * hijacked-looking one is not.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Route segments and reserved paths.
  "admin",
  "api",
  "auth",
  "dashboard",
  "settings",
  "sign-in",
  "signin",
  "sign-up",
  "signup",
  "org",
  "orgs",
  "organization",
  "daily",
  "leaderboard",
  "start",
  "join",
  "challenge",
  "about",
  "blog",
  "contact",
  "privacy",
  "terms",
  "u",
  "s",
  "r",
  "i",
  "assets",
  "static",
  "public",
  "favicon",
  "robots",
  "sitemap",
  "opengraph-image",
  // Identity and impersonation.
  "me",
  "you",
  "self",
  "intrv",
  "official",
  "support",
  "help",
  "team",
  "staff",
  "moderator",
  "mod",
  "root",
  "system",
  "null",
  "undefined",
  "anonymous",
  "everyone",
  "somebody",
  "someone",
]);

export type UsernameProblem =
  | "too-short"
  | "too-long"
  | "shape"
  | "reserved"
  | null;

/** The single reason a username is invalid, or null when it is fine. */
export function usernameProblem(raw: string): UsernameProblem {
  const name = raw.trim().toLowerCase();
  if (name.length < USERNAME_MIN) return "too-short";
  if (name.length > USERNAME_MAX) return "too-long";
  if (!SHAPE.test(name)) return "shape";
  if (RESERVED_USERNAMES.has(name)) return "reserved";
  return null;
}

export function isValidUsername(raw: string): boolean {
  return usernameProblem(raw) === null;
}

/** Human-readable message for each problem, for form and action error lines. */
export function usernameMessage(problem: UsernameProblem): string | null {
  switch (problem) {
    case "too-short":
      return `Use at least ${USERNAME_MIN} characters.`;
    case "too-long":
      return `Keep it under ${USERNAME_MAX} characters.`;
    case "shape":
      return "Lowercase letters, numbers, and single hyphens only.";
    case "reserved":
      return "That name is reserved. Pick another.";
    default:
      return null;
  }
}

// Short words (≤6 chars) so adj-noun-NNNN never exceeds USERNAME_MAX (20):
// 6 + 6 + 4 + two hyphens = 18.
const ADJECTIVES = [
  "swift",
  "brisk",
  "keen",
  "bright",
  "calm",
  "bold",
  "clever",
  "sharp",
  "quiet",
  "brave",
  "lucid",
  "nimble",
  "steady",
  "sunny",
  "witty",
  "eager",
  "mellow",
  "crisp",
  "vivid",
  "prime",
] as const;

const NOUNS = [
  "otter",
  "maple",
  "harbor",
  "falcon",
  "ember",
  "cedar",
  "comet",
  "willow",
  "pixel",
  "quartz",
  "raven",
  "delta",
  "onyx",
  "cobalt",
  "tiger",
  "meadow",
  "cipher",
  "vertex",
  "lotus",
  "zephyr",
] as const;

/**
 * A readable random username, e.g. "swift-otter-4821". The number gives ~10k
 * options per word pair, so collisions are rare; the caller still checks the
 * DB and calls again on the rare clash. `rand` is injectable so the generator
 * is deterministic under test.
 */
export function generateUsername(rand: () => number = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)];
  const num = Math.floor(rand() * 10000)
    .toString()
    .padStart(4, "0");
  return `${adj}-${noun}-${num}`;
}
