/**
 * Import-free on purpose, like owner.ts: both the client forms and the server
 * gates decide redirect targets with this, and it must be unit-testable without
 * dragging in the auth client or a request.
 */

export const DEFAULT_REDIRECT = "/dashboard";

/**
 * `?next=` is attacker-controlled, so it is an open redirect unless it provably
 * cannot leave this origin. Only a plain absolute path survives:
 *
 * - the leading `/` rejects every scheme (`https:`, `javascript:`),
 * - `//host` and `/\host` are protocol-relative once a browser normalises them,
 * - tabs and newlines are stripped during URL parsing, so `/{tab}/host` would
 *   become `//host` after we'd already approved it. Strip them before deciding.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_REDIRECT;

  const path = next.replace(/[\t\n\r]/g, "");

  if (!path.startsWith("/")) return DEFAULT_REDIRECT;
  if (path.startsWith("//") || path.startsWith("/\\")) return DEFAULT_REDIRECT;

  return path;
}

/**
 * The `/sign-in?next=…` a gate sends a signed-out visitor to.
 *
 * `pathname` comes from the x-pathname header that proxy.ts stamps on every
 * request, because a layout cannot otherwise know which of its children was
 * asked for — without it, someone bookmarking /dashboard/review would sign in
 * and land on /dashboard. It runs through safeNextPath because that header is
 * only trustworthy while proxy.ts is the one setting it; if its matcher ever
 * stops covering a route, the value is whatever the client sent.
 */
export function signInPath(
  pathname: string | null | undefined,
  fallback: string,
): string {
  const target = pathname ? safeNextPath(pathname) : fallback;

  return `/sign-in?next=${encodeURIComponent(target)}`;
}
