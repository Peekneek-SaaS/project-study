"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * The palette's list is a whole drive's worth of names, and it only ever
 * changes through a mutation — every one of which invalidates the `folder`
 * router. Holding it fresh for five minutes therefore costs nothing in
 * accuracy, and it is what makes a warmed cache still warm by the time the
 * palette is actually opened; the client default of 30s would expire first and
 * put the spinner back.
 */
const SEARCH_STALE_TIME = 5 * 60 * 1000;

/** One definition of the query, so every caller warms and reads the same entry. */
export function searchItemsOptions(trpc: ReturnType<typeof useTRPC>) {
  return {
    ...trpc.folder.getAllItems.queryOptions(),
    staleTime: SEARCH_STALE_TIME,
  };
}

/**
 * Fills the palette's cache ahead of time. Safe to call as often as the pointer
 * moves — a fetch already in flight is joined, and fresh data is left alone.
 */
export function usePrefetchSearchItems() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.prefetchQuery(searchItemsOptions(trpc));
  }, [queryClient, trpc]);
}

/**
 * Warms the palette once the browser has nothing better to do.
 *
 * Deliberately not part of the first render's work: the drive's own listing
 * should get the network to itself, and the palette is never the first thing
 * asked for. By the time it is, the answer is already sitting in the cache.
 */
export function useWarmSearchItems() {
  const prefetch = usePrefetchSearchItems();

  useEffect(() => {
    // Safari only grew `requestIdleCallback` recently; a short timer is a close
    // enough stand-in for "after the page has settled".
    if (typeof window.requestIdleCallback !== "function") {
      const timer = window.setTimeout(prefetch, 1000);
      return () => window.clearTimeout(timer);
    }

    const handle = window.requestIdleCallback(prefetch, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }, [prefetch]);
}
