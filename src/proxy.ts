import { type NextRequest, NextResponse } from "next/server";

/**
 * Not an auth boundary, and deliberately does no session work: authorization
 * lives in the DAL and is re-checked inside every Server Action. This only
 * stamps the requested path onto the request so a layout's auth gate can send a
 * signed-out visitor back to the page they actually asked for — a layout is
 * rendered for all its children and has no other way to know which one it was.
 *
 * The header is cloned-then-set, never appended, so a client that sends its own
 * x-pathname has it overwritten rather than believed. Gates still run the value
 * through safeNextPath, because that guarantee only holds on paths the matcher
 * below covers.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const { pathname, search } = request.nextUrl;

  headers.set("x-pathname", `${pathname}${search}`);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything a person can navigate to. Static assets and the auth endpoints
  // have no layout gate to serve, so they'd pay for a header nobody reads.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
