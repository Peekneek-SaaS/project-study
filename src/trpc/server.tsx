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
import {
  dehydrate,
  type FetchInfiniteQueryOptions,
  HydrationBoundary,
  type QueryKey,
} from "@tanstack/react-query";
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
  // No infinite branch: an infinite query has its own awaited helper below,
  // because the two take different options objects and calling the wrong
  // `prefetch*` for the shape hydrates under a key nothing looks up.
  await getQueryClient().prefetchQuery(queryOptions);
}

/**
 * `prefetchAwaited`, for a list that is scrolled rather than read whole.
 *
 * The same reasoning and the same hazard as the one above — a bare
 * `prefetchInfiniteQuery` is a floating promise, and `HydrateClient` snapshots
 * it mid-flight — with one addition worth knowing: this warms the *first page
 * only*, which is the entire point. The client's `useSuspenseInfiniteQuery`
 * hydrates that page and renders it without a spinner, and the sentinel at the
 * bottom asks for the second page when it is actually scrolled to.
 *
 * The options must come from `infiniteQueryOptions`, not `queryOptions`: an
 * infinite query key carries `type: "infinite"` and drops `cursor` from the
 * input, so a page warmed under a plain query key is a page the list will never
 * find.
 */
export async function prefetchInfiniteAwaited<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
>(
  /*
    Generic straight through rather than widened to one concrete shape.

    Every generic here is inferred from the options object the tRPC proxy built,
    and that is the whole point: pinning them — to `unknown`, or by reading
    `Parameters<QueryClient["prefetchInfiniteQuery"]>` — collapses the query key
    to `readonly unknown[]`, which tRPC's own key type is not assignable *from*.
    Passing them along keeps the call as well typed as it would be written out
    at the call site, with no `any` anywhere.
  */
  queryOptions: FetchInfiniteQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >,
) {
  await getQueryClient().prefetchInfiniteQuery(queryOptions);
}

export const caller = appRouter.createCaller(createTRPCContext);
