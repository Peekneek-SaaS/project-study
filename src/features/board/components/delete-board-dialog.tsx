"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import type { BoardListItem } from "@/features/board/types";
import { useTRPC } from "@/trpc/client";

/** Confirms deleting a board. */
export function DeleteBoardDialog({
  board,
  onClose,
}: {
  board: BoardListItem | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const remove = useMutation(trpc.board.remove.mutationOptions());

  // Held past closing so the name stays in the copy while the dialog animates
  // out — the row it names is gone by then.
  const [lastBoard, setLastBoard] = useState(board);
  if (board && board !== lastBoard) setLastBoard(board);
  const item = board ?? lastBoard;

  const handleDelete = async () => {
    if (!board) return;

    try {
      await remove.mutateAsync({ id: board.id });
      await queryClient.invalidateQueries(trpc.board.pathFilter());
      toast.success(`Deleted ${board.name}`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the board",
      );
    }
  };

  return (
    <Modal
      title={item ? `Delete ${item.name}?` : "Delete board?"}
      description="The board and everything drawn on it are removed. This cannot be undone."
      open={board !== null}
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose();
      }}
    >
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={remove.isPending}
        >
          {remove.isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
