import { redirect } from "next/navigation";
import { getViewer, signInHere } from "@/server/dal/session";

/**
 * Sends a signed-out visitor to sign-in and back to the page they asked for.
 *
 * **Callers must wrap this in `<Suspense>`.** getViewer() reads headers, which
 * cacheComponents treats as runtime data: awaiting it in a page or layout body
 * would block that route's static shell and fail the build. Isolated in a hole,
 * the shell prerenders and only the gate waits on the request.
 *
 * It is **not** the authorization boundary. It renders in parallel with the
 * page beside it, so that page's queries may already be in flight when this
 * redirects — every one of them must be safe on its own, and every Server
 * Action must re-check its own viewer, because a Server Function is a POST
 * endpoint reachable without ever loading this page.
 *
 * `fallback` is only used when the request carries no x-pathname (a path
 * proxy.ts's matcher doesn't cover); otherwise the real path wins, so a gate
 * mounted on a layout returns the visitor to the child page they wanted.
 */
export async function AuthGate({ fallback }: { fallback: string }) {
  const viewer = await getViewer();
  if (viewer.kind !== "user") redirect(await signInHere(fallback));
  return null;
}
