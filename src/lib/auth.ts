import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, organization, username } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { env, isGoogleOAuthEnabled } from "@/lib/env";
import {
  generateUsername,
  isValidUsername,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/lib/username";

/**
 * A readable random handle, guaranteed free. The plugin's unique constraint is
 * the real guarantee; this just avoids losing the create on a collision, which
 * at ~10k options per word-pair is rare. Bounded loop so a pathologically full
 * namespace can't spin forever — the last candidate carries entropy enough that
 * the DB constraint, not this, is what would ever reject it.
 */
async function freeUsername(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generateUsername();
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return generateUsername();
}

export const auth = betterAuth({
  appName: "Intrv",
  // baseURL is intentionally omitted: better-auth reads BETTER_AUTH_URL itself,
  // and hardcoding localhost here would break every non-local deployment.
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: isGoogleOAuthEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Skips a DB round-trip on every RSC getSession(). Cost: a revoked or banned
    // session stays valid for up to maxAge. Sensitive reads pass
    // `query: { disableCookieCache: true }` to force an authoritative check.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
    },
  },

  // Assign a random username to every new account (email or OAuth) when one
  // wasn't supplied — sign-up never asks for one. Runs before the row is
  // written, alongside the username plugin's own create hook.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const u = user as typeof user & { username?: string | null };
          if (u.username) return;
          const handle = await freeUsername();
          return {
            data: { ...user, username: handle, displayUsername: handle },
          };
        },
      },
    },
  },

  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Adds the unique `username` + `displayUsername` fields, the
    // is-username-available endpoint, and username validation. 5-20 chars,
    // lowercase letters/digits/hyphens, no reserved names — the same rules the
    // settings form and the generator share via lib/username.ts.
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => isValidUsername(value),
    }),
    // First-party organizations: owns the organization/member/invitation tables
    // and adds session.activeOrganizationId. Default roles owner/admin/member
    // match what the org DAL checks. The "3 owned orgs" cap and slug suffixing
    // are enforced in src/server/actions/org.ts, on top of this.
    organization(),
    // nextCookies() MUST stay last: it wraps the other plugins' hooks so cookies
    // set during a server action actually get written to the response.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
