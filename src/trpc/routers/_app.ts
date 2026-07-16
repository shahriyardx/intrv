import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { interviewRouter } from "@/trpc/routers/interview";

export const appRouter = createTRPCRouter({
  health: createTRPCRouter({
    ping: publicProcedure.query(() => ({ ok: true, at: new Date() })),
  }),
  interview: interviewRouter,
});

export type AppRouter = typeof appRouter;
