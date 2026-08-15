"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { noteFilterParsers } from "@/features/sticky-notes/lib/params";
import { useTRPC } from "@/trpc/client";

/**
 * The notes on the wall, narrowed by whatever the toolbar is asking for.
 *
 * Suspends while loading and throws on failure, so the caller supplies a
 * `<Suspense>` fallback and an error boundary rather than branching here — the
 * same contract as `useDriveBrowser` and `useBoardsBrowser`.
 */
export function useNotesBrowser() {
  const trpc = useTRPC();

  // Straight from the URL into the request: the filter is part of what is being
  // asked for, so it belongs in the query key rather than in a pass over the
  // answer.
  const [filters] = useQueryStates(noteFilterParsers);

  const { data: notes } = useSuspenseQuery(
    trpc.stickyNote.list.queryOptions(filters),
  );

  return {
    notes,
    // An empty wall means two different things, and only this knows which.
    isFiltering: filters.modified !== null,
  };
}
