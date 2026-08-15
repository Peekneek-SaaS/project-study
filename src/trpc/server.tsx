import "server-only"; // <-- ensure this file cannot be imported from the client
import {
  createTRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";
import type { AppRouter } from "./routers/_app";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});
// If your router is on a separate server, pass a client:
createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({
    links: [httpLink({ url: "..." })],
  }),
  queryClient: getQueryClient,
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

/**
 * `prefetch`, waited for.
 *
 * The version above hands the query to the streaming dehydrator and returns —
 * which works when it is called from a component that is already awaiting
 * something dynamic, because the request is still open underneath it. Called
 * from a component with nothing to await, the query runs as a floating promise
 * with the request scope going out from under it, and `auth()` inside a
 * protected procedure has nothing to read: the query rejects with
 * "Unauthorized", is dehydrated in that state, and `useSuspenseQuery` throws
 * with it on the server.
 *
 * Awaiting keeps the whole thing inside the request, and dehydrates resolved
 * data rather than a promise still deciding. Use this one from any server
 * component that is not already awaiting something else.
 */
export async function prefetchAwaited(
  // Borrowed from `prefetch` rather than restated, so the two cannot describe
  // different things.
  queryOptions: Parameters<typeof prefetch>[0],
) {
  // No infinite branch: an infinite query is a list being paged through, which
  // is exactly the case worth streaming rather than waiting for. Reach for
  // `prefetch` there.
  await getQueryClient().prefetchQuery(queryOptions);
}

export const caller = appRouter.createCaller(createTRPCContext);
