"use client";

import { useMemo } from "react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { boardFilterParsers } from "@/features/board/lib/params";
import { infiniteOptions } from "@/lib/pagination";
import { useTRPC } from "@/trpc/client";

/**
 * The boards on screen, narrowed by whatever the toolbar is asking for and
 * grown a page at a time as the table is scrolled.
 *
 * Suspends while loading and throws on failure, so the caller supplies a
 * `<Suspense>` fallback and an error boundary rather than branching here —
 * the same contract as `useDriveBrowser`.
 *
 * `useSuspenseInfiniteQuery` rather than the plain infinite one, and that is
 * what keeps the server prefetch worth having: the first page is warmed in
 * `boards-view.tsx` and hydrated here, so the table renders filled on the first
 * paint exactly as it did before. Only pages two and after cost a request, and
 * only when they are scrolled to.
 */
export function useBoardsBrowser() {
  const trpc = useTRPC();

  // Straight from the URL into the request: the filter is part of what is being
  // asked for, so it belongs in the query key rather than in a pass over the
  // answer. Each choice caches as its own list, and going back to one already
  // seen is instant — pages and all, because the cursor is *not* part of the
  // key. See `cursorInput` for why that is the right identity for a list.
  const [filters] = useQueryStates(boardFilterParsers);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.board.list.infiniteQueryOptions(filters, infiniteOptions),
    );

  // Flattened once per fetch rather than on every render: this list is the
  // dependency of the memo that builds the keyboard's row map, and a fresh
  // array each render would rebuild that map each render too.
  const boards = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  return {
    boards,
    // An empty list means two different things, and only this knows which.
    isFiltering: filters.modified !== null,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}
