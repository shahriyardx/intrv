import {
  defaultShouldDehydrateQuery,
  isServer,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        // React Query stamps freshness with Date.now(), which throws during a
        // Next prerender under cacheComponents. A static staleTime makes it bail
        // out before it needs a timestamp. See the note in trpc/server.tsx.
        ...(isServer ? { staleTime: "static" as const } : {}),
      },
      dehydrate: {
        serializeData: superjson.serialize,
        // Dehydrate still-pending queries so an RSC can kick off a fetch high in
        // the tree and a client component below can consume the same promise.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
