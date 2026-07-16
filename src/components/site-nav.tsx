import { Suspense } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { isAdminUser } from "@/server/dal/admin";
import { getAuthSession } from "@/server/dal/session";

/**
 * The session-dependent half of the header, kept out of SiteHeader itself for
 * two reasons:
 *
 *  - SiteHeader is imported by app/error.tsx, which is a client component. Any
 *    server-only import reachable from it would poison that bundle.
 *  - Reading the session is runtime IO. Behind this boundary the shell above it
 *    still prerenders; awaited in a page body it would take the whole route's
 *    static shell with it.
 *
 * The fallback is sized to the signed-out pair so the header doesn't reflow
 * when the real nav swaps in.
 */
export function SiteNav() {
  return (
    <Suspense fallback={<span aria-hidden className="h-8 w-[8.5rem]" />}>
      <SessionNav />
    </Suspense>
  );
}

async function SessionNav() {
  const session = await getAuthSession();

  if (!session) return <UserMenu user={null} />;

  // isAdminUser, not getAdminViewer: the latter claims an unclaimed admin seat,
  // and this renders on every page.
  const admin = await isAdminUser();

  return (
    // Only the two fields the menu renders cross to the client — never the
    // session row. See the note in UserMenu.
    <UserMenu
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
      isAdmin={admin}
    />
  );
}
