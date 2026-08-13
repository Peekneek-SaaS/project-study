"use client";

import { useCallback } from "react";
import type { DragEndEvent } from "@dnd-kit/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { DriveDragData, DriveDropData } from "@/features/main/types";
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

  const handleDragEnd = useCallback(
    ({ operation, canceled }: DragEndEvent) => {
      if (canceled) return;

      const drag = operation.source?.data as DriveDragData | undefined;
      const drop = operation.target?.data as DriveDropData | undefined;
      if (!drag || !drop) return;

      const { folderId: targetId } = drop;
      // Dropped back where it already lives.
      if (targetId === currentFolderId) return;

      if (drag.kind === "folder") {
        if (drag.id === targetId) return; // dropped on itself
        moveFolder.mutate({ id: drag.id, newParentId: targetId });
        return;
      }

      moveDocument.mutate({ id: drag.id, newFolderId: targetId });
    },
    [currentFolderId, moveDocument, moveFolder],
  );

  return {
    folders: data.folders,
    documents: data.documents,
    currentFolderId,
    parentFolderId,
    handleDragEnd,
    isMoving: moveFolder.isPending || moveDocument.isPending,
  };
}
