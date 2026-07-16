import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { discussionRouter } from "@/trpc/routers/discussion";
import { interviewRouter } from "@/trpc/routers/interview";

export const appRouter = createTRPCRouter({
  health: createTRPCRouter({
    ping: publicProcedure.query(() => ({ ok: true, at: new Date() })),
  }),
  interview: interviewRouter,
  discussion: discussionRouter,
});

export type AppRouter = typeof appRouter;
