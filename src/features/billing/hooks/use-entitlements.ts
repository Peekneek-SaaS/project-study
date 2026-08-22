"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

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

  /*
    Nobody signed in, nothing to ask.

    The provider holding this sits at the root of the app so that the settings
    dialog — which is mounted there, beside the pages rather than inside them —
    can read it. That puts it over the marketing page and the sign-in screens
    too, where the query would be a guaranteed 401 on every visit. `enabled` is
    what keeps a logged-out homepage from making an authenticated request it
    already knows the answer to.

    `isLoaded` matters as much as `isSignedIn`: Clerk reports "not signed in"
    until it has read the session, and firing on that first render would mean
    the query is created disabled and never runs.
  */
  const { isLoaded, isSignedIn } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    ...trpc.billing.entitlements.queryOptions(),
    enabled: isLoaded && isSignedIn,
    // Half a minute. Long enough that a page of components asking at once
    // costs one request, short enough that a meter is never meaningfully wrong.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    entitlements: data,
    // A disabled query is not loading, it is simply never going to answer —
    // reporting it as loading would leave every skeleton spinning forever on a
    // signed-out page.
    isLoading: isLoaded && isSignedIn ? isLoading : false,
    refetch,
  };
}

/**
 * "Something was just paid for — go and look again."
 *
 * Credits are spent by work that finishes *outside* this tab: a chat turn is a
 * background run, a document is read by a task minutes after the upload. So the
 * balance on screen is only ever as fresh as the last thing that told it to
 * look, and without this the meter is right after a reload and stale after
 * every question.
 *
 * Invalidates rather than refetches, so a screen with three components reading
 * the balance makes one request between them, and a component that is not
 * mounted does not fetch at all — it will get the fresh value when it next
 * mounts, which is exactly when it needs it.
 *
 * Deliberately fire-and-forget. Nothing should wait on a meter: the answer has
 * already arrived, and a number catching up half a second later is not
 * something anyone notices.
 */
export function useRefreshEntitlements() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries(trpc.billing.entitlements.queryFilter());
  }, [queryClient, trpc]);
}
