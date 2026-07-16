import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { env, isGoogleOAuthEnabled } from "@/lib/env";

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

  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
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
