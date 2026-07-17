import "server-only";
import type { Route } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { auth, type Session } from "@/lib/auth";
import { signInPath } from "@/lib/next-path";
import type { Viewer } from "@/server/dal/owner";

export {
  canAccessSession,
  isAdmin,
  ownerWhere,
  type Viewer,
} from "@/server/dal/owner";

/**
 * The raw session, for the few places that need a name or an email rather than
 * an access decision — the header's user menu, mainly. Memoized alongside
 * getViewer() so wanting both costs one read, not two.
 *
 * Prefer getViewer() everywhere else: it narrows this to the access model, and
 * nothing downstream of it can accidentally grow a dependency on a user field.
 */
export const getAuthSession = cache(async (): Promise<Session | null> => {
  return await auth.api.getSession({ headers: await headers() });
});

/**
 * Who is asking. Memoized per render pass, so a page whose components each need
 * the viewer still costs one session read.
 *
 * There is no guest identity: a signed-out visitor is simply anonymous, and
 * reaches their interview by holding its id.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getAuthSession();

  if (session?.user) {
    return {
      kind: "user",
      userId: session.user.id,
      role: session.user.role ?? null,
      banned: Boolean(session.user.banned),
    };
  }

  return { kind: "anonymous" };
});

/**
 * Where to send a signed-out visitor so that signing in returns them here.
 *
 * `fallback` is used when proxy.ts didn't stamp the path — it should be the
 * gate's own route, so the redirect is merely imprecise rather than wrong.
 */
export async function signInHere(fallback: string): Promise<Route> {
  // Built at runtime, so typedRoutes can't check it. safeNextPath inside
  // signInPath is what actually constrains the value.
  return signInPath((await headers()).get("x-pathname"), fallback) as Route;
}
