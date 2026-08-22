"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { MAX_PAGE_SIZE } from "@/lib/pagination";
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
 * Boards, as their own query rather than folded into the one above.
 *
 * Two requests, but not two round trips: the client batches, and both of these
 * are asked for in the same tick. What it buys is that each router keeps
 * answering for its own data — a board mutation invalidates `board` and the
 * palette follows, with nothing in the board feature having to know that a
 * query in the folder router quietly included its rows.
 */
export function searchBoardsOptions(trpc: ReturnType<typeof useTRPC>) {
  return {
    ...trpc.board.list.queryOptions({ limit: MAX_PAGE_SIZE }),
    staleTime: SEARCH_STALE_TIME,
  };
}

/** Notes, on the same terms as boards — its own router, its own invalidation. */
export function searchNotesOptions(trpc: ReturnType<typeof useTRPC>) {
  return {
    ...trpc.stickyNote.list.queryOptions({ limit: MAX_PAGE_SIZE }),
    staleTime: SEARCH_STALE_TIME,
  };
}

/**
 * Conversations, on the same terms again.
 *
 * A *plain* query against a procedure the recents list reads as an infinite
 * one, and that is deliberate rather than an oversight. The two want opposite
 * things: the recents table is scrolled, so it takes a page at a time; the
 * palette is typed into, and the reason to open it is to find the conversation
 * you cannot see — so it takes as much as the router will give, in one go,
 * filtered in the browser with no round trip per keystroke.
 *
 * Because an infinite key and a query key are different keys, the two never
 * fight over one cache entry. This one is kept fresh by the `pathFilter`
 * invalidations the chat mutations use, which match both.
 *
 * `MAX_PAGE_SIZE` is the router's ceiling, and the same reasoning applies to
 * the boards and notes above. Beyond it an old row is findable by its own URL
 * and not by this palette — the honest fix there is to search server-side, not
 * to raise a number.
 */
export function searchChatsOptions(trpc: ReturnType<typeof useTRPC>) {
  return {
    ...trpc.chat.list.queryOptions({ limit: MAX_PAGE_SIZE }),
    staleTime: SEARCH_STALE_TIME,
  };
}

/**
 * Tasks, on the same terms as the three above.
 *
 * The bare list, with no filters passed — which is the same cache entry the
 * todo page's default view reads, so opening the palette on that page costs
 * nothing at all. A filtered todo page keeps its own entry and this one stays
 * whole, which is what search wants: the point of looking a task up is to find
 * the one the current filter is hiding.
 */
export function searchTodosOptions(trpc: ReturnType<typeof useTRPC>) {
  return {
    ...trpc.todo.list.queryOptions(),
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
    void queryClient.prefetchQuery(searchBoardsOptions(trpc));
    void queryClient.prefetchQuery(searchNotesOptions(trpc));
    void queryClient.prefetchQuery(searchChatsOptions(trpc));
    void queryClient.prefetchQuery(searchTodosOptions(trpc));
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
