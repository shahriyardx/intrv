/**
 * Pure ownership logic. Deliberately free of imports: this decides who can read
 * what, so it must be unit-testable without a database, a session, or an
 * environment.
 */

export type Viewer =
  | { kind: "user"; userId: string; role: string | null; banned: boolean }
  | { kind: "guest"; guestId: string }
  | { kind: "anonymous" };

/**
 * The single owner predicate for every interview-session query.
 *
 * A session belongs to exactly one of a user or a guest cookie, so ownership is
 * a two-branch check. Centralising it here keeps that branching from spreading
 * across the codebase, and makes moving to a user-row-per-guest model later a
 * one-file change.
 *
 * Returns null for an anonymous viewer: they own nothing. Callers must treat
 * null as "match nothing" — spreading an empty object into a Prisma `where`
 * would match every row in the table.
 */
export function ownerWhere(
  viewer: Viewer,
): { userId: string } | { guestId: string } | null {
  switch (viewer.kind) {
    case "user":
      return { userId: viewer.userId };
    case "guest":
      return { guestId: viewer.guestId };
    case "anonymous":
      return null;
  }
}

export function isAdmin(viewer: Viewer): boolean {
  return viewer.kind === "user" && viewer.role === "admin" && !viewer.banned;
}
