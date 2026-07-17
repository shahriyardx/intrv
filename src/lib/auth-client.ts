import {
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [
    // Teaches the client the server's real user shape — the admin plugin's
    // `role` and `banned` live there, not in better-auth's base user. `import
    // type` is load-bearing: auth.ts reaches db.ts, which is server-only, and a
    // value import would drag it into the browser bundle.
    inferAdditionalFields<typeof auth>(),
    // Only for accepting an invite: the invitee has no membership yet, so there
    // is no server action that could act for them. Everything else an org does
    // goes through a Server Action that re-checks membership.
    organizationClient(),
  ],
});

const DEFAULT_REDIRECT = "/dashboard";

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
