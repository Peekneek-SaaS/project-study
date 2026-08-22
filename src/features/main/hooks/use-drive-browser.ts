"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";

import { useRefreshEntitlements } from "@/features/billing/hooks/use-entitlements";
import { isTransientStatus } from "@/features/main/lib/document-status";
import { useDriveNavigation } from "@/features/main/hooks/use-drive-navigation";
import { driveFilterParsers } from "@/features/main/lib/params";
import type { DriveDragData, DriveDropData } from "@/features/main/types";
import { infiniteOptions } from "@/lib/pagination";
import { useDriveSelectionStore } from "@/lib/stores/drive-selection-store";
import { useTRPC } from "@/trpc/client";

/**
 * How often the listing re-asks while a workspace is being built.
 *
 * Short enough that "Building" turning into "Complete" feels like it happened
 * on its own, long enough that a folder of ten uploads is not a request a
 * second. The job itself takes about a second, so most builds are caught on the
 * first or second poll.
 */
const WORKSPACE_POLL_MS = 2_000;

/**
 * Contents of the folder being browsed, plus the drag-and-drop wiring that
 * moves things between folders.
 *
 * Suspends while loading and throws on failure, so the caller supplies a
 * `<Suspense>` fallback and an error boundary rather than branching here.
 */
export function useDriveBrowser() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Straight off the URL, which is what makes a reload land back in the folder
  // you were in — see `useDriveNavigation`.
  const { folderId: currentFolderId } = useDriveNavigation();

  /*
    The trail, and through it the folder one level up.

    `useSuspenseQuery` rather than a plain one, and this is the read that makes
    every other reader of this key safe: the drive does not render until the
    trail is known, so the breadcrumb bar and the Back button never have to draw
    a half-known path. It costs nothing extra to fetch — the client batches, so
    this rides in the same HTTP request as the listing beside it, and on a
    reload both were already prefetched on the server.
  */
  const { data: trail } = useSuspenseQuery(
    trpc.folder.getBreadcrumb.queryOptions({ folderId: currentFolderId }),
  );

  const parentFolderId = trail.at(-2)?.id ?? null;

  // Straight from the URL into the request: the filters are part of what is
  // being asked for, so they belong in the query key rather than in a pass over
  // the answer. Each combination caches as its own listing, and going back to
  // an already-seen one is instant.
  const [filters] = useQueryStates(driveFilterParsers);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery({
      ...trpc.folder.getContents.infiniteQueryOptions(
        { folderId: currentFolderId, ...filters },
        infiniteOptions,
      ),
      /**
       * Workspaces are built by a background job, and nothing tells this listing
       * when one finishes — so while any row is still queued or building, the
       * listing asks again.
       *
       * A function rather than a number so it reads the *answer* each time: the
       * polling stops on its own the moment the last row settles, and a folder of
       * finished documents never polls at all. `refetchIntervalInBackground` is
       * left off, so a tab nobody is looking at goes quiet and catches up when it
       * is focused again.
       *
       * Now that the listing is paged, `state.data` is every page loaded so far
       * and a refetch refreshes all of them — which is what should happen: an
       * upload sitting on page three has to be able to finish building while you
       * are looking at it. The poll still stops the moment nothing anywhere in
       * the loaded listing is transient, so scrolling further does not keep a
       * settled drive awake.
       */
      refetchInterval: ({ state }) =>
        state.data?.pages.some((page) =>
          page.documents.some((doc) => isTransientStatus(doc.overallStatus)),
        )
          ? WORKSPACE_POLL_MS
          : false,
    });

  /*
    Both halves of the listing, flattened back into the two arrays the drive has
    always rendered.

    The router pages folders and files as one sequence — see `getContents` — so
    a page carries whichever of the two the cursor had reached, and concatenating
    each kind across pages puts them back in their own order. Folders can only
    appear in the pages before files start, so nothing here has to re-sort.
  */
  const folders = useMemo(
    () => data.pages.flatMap((page) => page.folders),
    [data.pages],
  );
  const documents = useMemo(
    () => data.pages.flatMap((page) => page.documents),
    [data.pages],
  );

  /*
    Reading a document costs credits, and the meter finds out here.

    The charge happens inside the background task, so nothing in the browser
    knows it has been made. What the browser *does* know is the moment the last
    document stopped being transient — the poll above is already watching for
    exactly that — so the balance is refreshed on the edge from "something is
    processing" to "nothing is".

    An edge and not a level: refreshing whenever nothing is processing would
    mean a request on every render of a settled drive, which is most of them.
  */
  const refreshEntitlements = useRefreshEntitlements();
  const wasProcessing = useRef(false);

  const isProcessing = documents.some((doc) =>
    isTransientStatus(doc.overallStatus),
  );

  useEffect(() => {
    if (wasProcessing.current && !isProcessing) refreshEntitlements();
    wasProcessing.current = isProcessing;
  }, [isProcessing, refreshEntitlements]);

  // A move rewrites two folders' listings, so refresh them all rather than
  // guessing which ones are cached — and the whole router with them, since the
  // search palette's index carries the parent that just changed.
  const onSettled = useCallback(
    () => queryClient.invalidateQueries(trpc.folder.pathFilter()),
    [queryClient, trpc],
  );
  const onError = useCallback((error: { message: string }) => {
    toast.error(error.message);
  }, []);

  const moveFolder = useMutation(
    trpc.folder.move.mutationOptions({ onSettled, onError }),
  );
  const moveDocument = useMutation(
    trpc.document.move.mutationOptions({ onSettled, onError }),
  );
  const bulkMove = useMutation(
    trpc.folder.bulkMove.mutationOptions({
      onSettled,
      onError,
      onSuccess: ({ skipped }) => {
        // The only thing the server declines to move is a folder that would end
        // up inside itself, so say so rather than leaving a row unexplained.
        if (skipped > 0) {
          toast.error(
            skipped === 1
              ? "A folder was left behind — it cannot be moved into itself."
              : `${skipped} folders were left behind — they cannot be moved into themselves.`,
          );
        }
      },
    }),
  );

  /**
   * Marks the drag as carrying the selection, so every ticked row can show it
   * is on the move — dnd-kit only reports `isDragging` to the row under the
   * pointer, which would otherwise leave the other rows sitting still.
   */
  const handleDragStart = useCallback(({ operation }: DragStartEvent) => {
    const drag = operation.source?.data as DriveDragData | undefined;
    if (!drag) return;

    const { folderIds, documentIds, setDraggingSelection } =
      useDriveSelectionStore.getState();
    const isSelected =
      drag.kind === "folder" ? folderIds.has(drag.id) : documentIds.has(drag.id);

    setDraggingSelection(isSelected && folderIds.size + documentIds.size > 1);
  }, []);

  const handleDragEnd = useCallback(
    ({ operation, canceled }: DragEndEvent) => {
      // What the drag decided it was carrying when it started, before the flag
      // is cleared. Recomputing it here would read a selection that may have
      // changed under the drag: a touch hold arms the drag and ticks the row on
      // the same timer, and the tick lands second — so a row held while other
      // rows were selected starts out carrying only itself and would arrive
      // looking like it had brought the whole selection with it.
      const { isDraggingSelection, setDraggingSelection } =
        useDriveSelectionStore.getState();
      setDraggingSelection(false);
      if (canceled) return;

      const drag = operation.source?.data as DriveDragData | undefined;
      const drop = operation.target?.data as DriveDropData | undefined;
      if (!drag || !drop) return;

      const { folderId: targetId } = drop;
      // Dropped back where it already lives.
      if (targetId === currentFolderId) return;

      // Which rows those are, though, is read now rather than at drag start —
      // and read rather than subscribed to, so this handler is not rebuilt on
      // every tick.
      const { folderIds, documentIds, clear } =
        useDriveSelectionStore.getState();

      // Picking up a ticked row carries the whole selection; picking up
      // anything else moves just that thing, ticks elsewhere notwithstanding.
      if (isDraggingSelection) {
        // Dropping a selection onto one of its own folders puts the rest
        // inside it; that folder stays where it is.
        const selectedFolders = [...folderIds].filter((id) => id !== targetId);
        const selectedDocuments = [...documentIds];
        if (selectedFolders.length === 0 && selectedDocuments.length === 0) {
          return;
        }

        // The rows are leaving this listing, so the ticks go with them.
        clear();
        bulkMove.mutate({
          folderIds: selectedFolders,
          documentIds: selectedDocuments,
          targetFolderId: targetId,
        });
        return;
      }

      if (drag.kind === "folder") {
        if (drag.id === targetId) return; // dropped on itself
        moveFolder.mutate({ id: drag.id, newParentId: targetId });
        return;
      }

      moveDocument.mutate({ id: drag.id, newFolderId: targetId });
    },
    [bulkMove, currentFolderId, moveDocument, moveFolder],
  );

  return {
    folders,
    documents,
    currentFolderId,
    parentFolderId,
    // An empty listing means two different things, and only this knows which.
    isFiltering: filters.type !== null || filters.modified !== null,
    handleDragStart,
    handleDragEnd,
    isMoving:
      moveFolder.isPending || moveDocument.isPending || bulkMove.isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}
