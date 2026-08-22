"use client";

import { useMemo } from "react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { noteFilterParsers } from "@/features/sticky-notes/lib/params";
import { infiniteOptions } from "@/lib/pagination";
import { useTRPC } from "@/trpc/client";

/**
 * The notes on the wall, narrowed by whatever the toolbar is asking for and
 * grown a page at a time as the wall is scrolled.
 *
 * Suspends while loading and throws on failure, so the caller supplies a
 * `<Suspense>` fallback and an error boundary rather than branching here — the
 * same contract as `useDriveBrowser` and `useBoardsBrowser`.
 *
 * The day grouping downstream is unaffected by the paging, and that is a
 * property of the order rather than luck: the wall is sorted by `createdAt`
 * descending, so a page boundary can only ever fall *inside* a day or between
 * two of them — never in a way that splits one day into two headings, because
 * the notes for a day arrive contiguously or not at all. `groupNotesByDay` runs
 * over the flattened list, so a day that straddles a boundary simply grows.
 */
export function useNotesBrowser() {
  const trpc = useTRPC();

  // Straight from the URL into the request: the filter is part of what is being
  // asked for, so it belongs in the query key rather than in a pass over the
  // answer.
  const [filters] = useQueryStates(noteFilterParsers);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.stickyNote.list.infiniteQueryOptions(filters, infiniteOptions),
    );

  // Flattened once per fetch rather than per render — see `useBoardsBrowser`.
  const notes = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  return {
    notes,
    // An empty wall means two different things, and only this knows which.
    isFiltering: filters.modified !== null,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}
