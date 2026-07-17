import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isOrgAccount } from "@/server/dal/org";

/**
 * Sends org accounts to their own surface. Mounted on the personal pages that
 * have an org mirror — dashboard, start, daily — and deliberately NOT on
 * /s/[sessionId] or its result: a signed-in org user can legitimately be a
 * candidate in someone else's assessment or take a challenge link, and yanking
 * them to /org mid-interview would eat their session.
 *
 * Rendered as a Suspense sibling so the host page keeps its static shell; the
 * redirect, when it fires, aborts the render before anything is sent. Not an
 * authorization boundary — every page and action re-checks its own access.
 */
export function OrgAccountGate() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  if (await isOrgAccount()) redirect("/org");
  return null;
}
