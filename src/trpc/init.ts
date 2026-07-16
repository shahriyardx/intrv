import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";

/**
 * Takes `headers` rather than reading `next/headers` itself so the exact same
 * context serves both the fetch route handler (req.headers) and any server-side
 * caller (await headers()).
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers: opts.headers });

  return {
    session,
    headers: opts.headers,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  // Prisma returns Date objects everywhere; without a transformer they arrive
  // as strings and the inferred types quietly lie.
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

/** Requires a signed-in user. Narrows ctx.session to non-null downstream. */
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({ ctx: { session: opts.ctx.session } });
});

/**
 * Requires an admin. The role check is authoritative — it re-reads the session
 * with the cookie cache disabled so a just-revoked admin can't linger for the
 * cache's 5 minute window.
 */
export const adminProcedure = protectedProcedure.use(async (opts) => {
  const fresh = await auth.api.getSession({
    headers: opts.ctx.headers,
    query: { disableCookieCache: true },
  });

  if (!fresh || fresh.user.role !== "admin" || fresh.user.banned) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return opts.next({ ctx: { session: fresh } });
});
