"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { boardFilterParsers } from "@/features/board/lib/params";
import { useTRPC } from "@/trpc/client";

/**
 * The boards on screen, narrowed by whatever the toolbar is asking for.
 *
 * Suspends while loading and throws on failure, so the caller supplies a
 * `<Suspense>` fallback and an error boundary rather than branching here —
 * the same contract as `useDriveBrowser`.
 */
export function useBoardsBrowser() {
  const trpc = useTRPC();

  // Straight from the URL into the request: the filter is part of what is being
  // asked for, so it belongs in the query key rather than in a pass over the
  // answer. Each choice caches as its own list, and going back to one already
  // seen is instant.
  const [filters] = useQueryStates(boardFilterParsers);

  const { data: boards } = useSuspenseQuery(
    trpc.board.list.queryOptions(filters),
  );

  return {
    boards,
    // An empty list means two different things, and only this knows which.
    isFiltering: filters.modified !== null,
  };
}
