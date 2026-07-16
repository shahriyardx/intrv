"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpBatchStreamLink,
  splitLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import superjson from "superjson";
import { makeQueryClient } from "@/trpc/query-client";
import type { AppRouter } from "@/trpc/routers/_app";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Server: a fresh client per request, or one user's cache leaks into another's.
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: reuse, so a suspended initial render doesn't rebuild it.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  const base =
    typeof window !== "undefined"
      ? ""
      : (process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000");
  return `${base}/api/trpc`;
}

export function TRPCReactProvider(
  props: Readonly<{ children: React.ReactNode }>,
) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        splitLink({
          // Streaming procedures opt in explicitly. Everything else stays on the
          // batch link, which can still set headers/cookies mid-request —
          // httpBatchStreamLink cannot once the stream has begun.
          condition: (op) => op.context.stream === true,
          true: httpBatchStreamLink({ url: getUrl(), transformer: superjson }),
          false: httpBatchLink({ url: getUrl(), transformer: superjson }),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
