/**
 * Pure access logic. Deliberately free of imports: this decides who can read
 * what, so it must be unit-testable without a database, a session, or an
 * environment.
 */

export type Viewer =
  | { kind: "user"; userId: string; role: string | null; banned: boolean }
  | { kind: "anonymous" };

/**
 * Access model
 * ------------
 * A session created while signed out has `userId === null` and is reachable by
 * anyone holding its id — the random UUID *is* the capability, like an unlisted
 * link. That is the whole design: no account, no cookie, take the interview,
 * read the result.
 *
 * A session created while signed in belongs to that user and nobody else,
 * including anonymous visitors who somehow learn the id.
 *
 * The asymmetry is deliberate. An anonymous session has nothing to protect
 * beyond the id itself, whereas a signed-in user's history is theirs.
 */
export function canAccessSession(
  session: { userId: string | null },
  viewer: Viewer,
): boolean {
  if (session.userId === null) return true;
  return viewer.kind === "user" && viewer.userId === session.userId;
}

/**
 * Scopes a *listing* query to the viewer.
 *
 * Returns null for an anonymous viewer, who has no history to list — callers
 * must treat null as "match nothing". Never return an empty object here: spread
 * into a Prisma `where` it would match every row in the table.
 */
export function ownerWhere(viewer: Viewer): { userId: string } | null {
  return viewer.kind === "user" ? { userId: viewer.userId } : null;
}

export function isAdmin(viewer: Viewer): boolean {
  return viewer.kind === "user" && viewer.role === "admin" && !viewer.banned;
}
