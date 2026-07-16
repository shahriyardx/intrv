import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { readGuestId } from "@/lib/guest";
import type { Viewer } from "@/server/dal/owner";

export { isAdmin, ownerWhere, type Viewer } from "@/server/dal/owner";

/**
 * Who is asking. Memoized per render pass, so a page whose components each need
 * the viewer still costs one session read.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    return {
      kind: "user",
      userId: session.user.id,
      role: session.user.role ?? null,
      banned: Boolean(session.user.banned),
    };
  }

  const guestId = await readGuestId();
  return guestId ? { kind: "guest", guestId } : { kind: "anonymous" };
});
