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

// safeNextPath moved to lib/next-path.ts: the server-side auth gates need it
// too, and importing this module there would drag createAuthClient with it.
export { safeNextPath } from "@/lib/next-path";
