import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const GUEST_COOKIE_NAME = "ia_guest";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * The guest id decides which interview sessions a signed-out visitor owns, so
 * it is signed: an attacker who could forge it could read anyone's guest
 * results. Value format is `<id>.<hmac>`.
 */
function sign(id: string): string {
  const mac = createHmac("sha256", env.GUEST_COOKIE_SECRET)
    .update(id)
    .digest("base64url");
  return `${id}.${mac}`;
}

export function parseGuestCookie(raw: string | undefined): string | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const id = raw.slice(0, separator);
  const mac = raw.slice(separator + 1);
  const expected = createHmac("sha256", env.GUEST_COOKIE_SECRET)
    .update(id)
    .digest("base64url");

  // Both are base64url of a sha256 digest, so lengths match unless the cookie
  // was tampered with — in which case bail before timingSafeEqual throws.
  if (mac.length !== expected.length) return null;

  const ok = timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  return ok ? id : null;
}

export function newGuestId(): string {
  return `g_${randomBytes(16).toString("base64url")}`;
}

/** Read-only: never mutates cookies, so it is safe in any server context. */
export async function readGuestId(): Promise<string | null> {
  const store = await cookies();
  return parseGuestCookie(store.get(GUEST_COOKIE_NAME)?.value);
}

/**
 * Returns the caller's guest id, minting one if absent.
 *
 * Cookie writes are only permitted in Server Actions and Route Handlers; in a
 * Server Component the write throws and we fall back to returning the id
 * without persisting it. Callers that need the id to stick (i.e. before
 * creating a session row) must run inside an action or route handler.
 */
export async function getOrCreateGuestId(): Promise<string> {
  const store = await cookies();
  const existing = parseGuestCookie(store.get(GUEST_COOKIE_NAME)?.value);
  if (existing) return existing;

  const id = newGuestId();

  try {
    store.set(GUEST_COOKIE_NAME, sign(id), {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  } catch {
    // Read-only cookie store (Server Component render). The caller still gets a
    // usable id; it just won't persist until an action sets it.
  }

  return id;
}

export async function clearGuestCookie(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_COOKIE_NAME);
}
