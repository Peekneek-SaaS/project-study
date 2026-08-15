"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useBoardSelectionStore } from "@/lib/stores/board-selection-store";
import { useTRPC } from "@/trpc/client";

/**
 * Confirms deleting everything ticked in the table.
 *
 * Separate from `DeleteBoardDialog` rather than folded into it: that one is
 * built around a single named board, and the count, the copy and the selection
 * to clear afterwards all differ here — the same split the drive makes between
 * its delete and its bulk delete.
 */
export function DeleteBoardsDialog({
  ids,
  onClose,
}: {
  /** The ticked boards, or `null` when the dialog is not up. */
  ids: string[] | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const clearSelection = useBoardSelectionStore((state) => state.clear);

  const bulkRemove = useMutation(trpc.board.bulkRemove.mutationOptions());

  // Held past closing so the count stays in the copy while the dialog animates
  // out — the rows it counts are gone by then.
  const [lastIds, setLastIds] = useState(ids);
  if (ids && ids !== lastIds) setLastIds(ids);
  const items = ids ?? lastIds;

  const handleOpenChange = (open: boolean) => {
    if (open || bulkRemove.isPending) return;
    onClose();
  };

  const handleDelete = async () => {
    if (!ids || bulkRemove.isPending) return;

    try {
      const { count } = await bulkRemove.mutateAsync({ ids });
      toast.success(`Deleted ${count} ${count === 1 ? "board" : "boards"}`);
      clearSelection();
      onClose();
      await queryClient.invalidateQueries(trpc.board.pathFilter());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete these boards",
      );
    }
  };

  if (!items) return null;

  const count = items.length;

  return (
    <Modal
      open={ids !== null}
      onOpenChange={handleOpenChange}
      title={`Delete ${count} ${count === 1 ? "board" : "boards"}?`}
      description="The boards and everything drawn on them are removed. This cannot be undone."
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={bulkRemove.isPending}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={bulkRemove.isPending}
          onClick={handleDelete}
        >
          {bulkRemove.isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
