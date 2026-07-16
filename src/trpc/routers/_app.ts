import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  health: createTRPCRouter({
    ping: publicProcedure.query(() => ({ ok: true, at: new Date() })),

    /**
     * Spike: an async-generator query. The client receives a growing array that
     * re-renders per yield — the mechanism the question stream will use.
     */
    countdown: publicProcedure
      .input(z.object({ n: z.number().int().min(1).max(10) }))
      .query(async function* ({ input, signal }) {
        for (let i = 1; i <= input.n; i++) {
          if (signal?.aborted) return;
          await new Promise((r) => setTimeout(r, 100));
          yield { i, at: new Date() };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
