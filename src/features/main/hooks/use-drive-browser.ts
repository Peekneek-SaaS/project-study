"use client";

import { useCallback } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { DriveDragData, DriveDropData } from "@/features/main/types";
import { useDriveSelectionStore } from "@/lib/stores/drive-selection-store";
import {
  selectCurrentFolderId,
  selectParentFolderId,
  useDriveStore,
} from "@/lib/stores/drive-store";
import { useTRPC } from "@/trpc/client";

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

  const currentFolderId = useDriveStore(selectCurrentFolderId);
  const parentFolderId = useDriveStore(selectParentFolderId);

  const { data } = useSuspenseQuery(
    trpc.folder.getContents.queryOptions({ folderId: currentFolderId }),
  );

  // A move rewrites two folders' listings, so refresh them all rather than
  // guessing which ones are cached.
  const onSettled = useCallback(
    () => queryClient.invalidateQueries(trpc.folder.getContents.pathFilter()),
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
      useDriveSelectionStore.getState().setDraggingSelection(false);
      if (canceled) return;

      const drag = operation.source?.data as DriveDragData | undefined;
      const drop = operation.target?.data as DriveDropData | undefined;
      if (!drag || !drop) return;

      const { folderId: targetId } = drop;
      // Dropped back where it already lives.
      if (targetId === currentFolderId) return;

      // Picking up a ticked row carries the whole selection; picking up
      // anything else moves just that thing, ticks elsewhere notwithstanding.
      // Read at drop time rather than subscribed to, so this handler is not
      // rebuilt on every tick.
      const { folderIds, documentIds, clear } =
        useDriveSelectionStore.getState();
      const isSelected =
        drag.kind === "folder"
          ? folderIds.has(drag.id)
          : documentIds.has(drag.id);

      if (isSelected && folderIds.size + documentIds.size > 1) {
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
    folders: data.folders,
    documents: data.documents,
    currentFolderId,
    parentFolderId,
    handleDragStart,
    handleDragEnd,
    isMoving:
      moveFolder.isPending || moveDocument.isPending || bulkMove.isPending,
  };
}
