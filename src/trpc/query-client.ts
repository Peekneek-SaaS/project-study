import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
// import superjson from "superjson";
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // serializeData: superjson.serialize,
        //
        // Settled queries only. Dehydrating pending ones is the tRPC docs'
        // setup for streamed hydration, where the server keeps the request
        // open and pushes each result down as it lands. This app has no such
        // provider, so a pending query shipped to the client is a promise
        // nothing will ever settle — and if it rejects after the snapshot was
        // taken, React Query can only complain about it on the way past.
        //
        // Nothing is lost by waiting: every server prefetch here goes through
        // `prefetchAwaited`, so the cache holds finished queries by the time
        // any boundary dehydrates it.
        shouldDehydrateQuery: defaultShouldDehydrateQuery,
      },
      hydrate: {
        // deserializeData: superjson.deserialize,
      },
    },
  });
}
