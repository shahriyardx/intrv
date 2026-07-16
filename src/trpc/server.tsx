import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  createTRPCOptionsProxy,
  type TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { createTRPCContext } from "@/trpc/init";
import { makeQueryClient } from "@/trpc/query-client";
import { appRouter } from "@/trpc/routers/_app";

/** Stable per-request client, so prefetch and dehydrate see the same cache. */
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: async () => createTRPCContext({ headers: await headers() }),
  router: appRouter,
  queryClient: getQueryClient,
});

/**
 * React Query's dehydrate() stamps entries with Date.now(). Under
 * cacheComponents that is illegal during a prerender, so this component first
 * awaits connection() to mark itself request-time — which is what actually
 * moves it out of the static shell. A <Suspense> boundary alone does NOT do
 * that: it supplies a fallback, it does not opt anything into dynamic
 * rendering.
 *
 * Callers must still wrap this in <Suspense>, or the whole route loses its
 * static shell.
 */
export async function HydrateClient(props: { children: React.ReactNode }) {
  await connection();
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

// The `any`s are load-bearing and come from tRPC's own documented helper: the
// options proxy is generic over every procedure, and narrowing it here would
// reject valid inputs. Callers stay fully typed via T.
// biome-ignore lint/suspicious/noExplicitAny: tRPC's documented prefetch helper
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // biome-ignore lint/suspicious/noExplicitAny: infinite-query options are not narrowable here
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
