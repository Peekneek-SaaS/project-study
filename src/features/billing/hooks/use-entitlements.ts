"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

/**
 * What this account may do, as the browser sees it.
 *
 * A plain query rather than a suspense one: this is read by the composer, the
 * upload button and the sidebar meter, and none of those should be able to
 * suspend the page they are in. While it is loading, `undefined` means "we do
 * not know yet", which every caller below treats as "let them try" — the server
 * is the thing that actually refuses, and a UI that greys its own buttons out
 * for half a second on every navigation is worse than one that occasionally
 * shows a paywall a moment late.
 *
 * The refetch settings are the important part. Credits change from *outside*
 * this tab — a background task finishing, a webhook granting a new cycle, a
 * purchase completing in the Polar window — so the balance is refetched when
 * the tab is focused again rather than only when something here changed it.
 */
export function useEntitlements() {
  const trpc = useTRPC();

  const { data, isLoading, refetch } = useQuery({
    ...trpc.billing.entitlements.queryOptions(),
    // Half a minute. Long enough that a page of components asking at once
    // costs one request, short enough that a meter is never meaningfully wrong.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return { entitlements: data, isLoading, refetch };
}
