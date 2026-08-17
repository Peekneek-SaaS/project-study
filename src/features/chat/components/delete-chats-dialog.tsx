"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useChatSelectionStore } from "@/lib/stores/chat-selection-store";
import { useTRPC } from "@/trpc/client";

/**
 * Confirms deleting the ticked conversations.
 *
 * One dialog for one chat and for twenty, unlike the boards' pair: there is no
 * per-chat copy worth writing that the count does not already say, and a
 * conversation's title is rarely the thing someone is checking before they
 * delete it — the number is.
 *
 * Lives in the table rather than in a row, because a row unmounts the moment
 * the list refetches and would take its dialog with it.
 */
export function DeleteChatsDialog({
  ids,
  onClose,
}: {
  /** The ticked conversations, or `null` when the dialog is not up. */
  ids: string[] | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const clearSelection = useChatSelectionStore((state) => state.clear);

  const bulkRemove = useMutation(trpc.chat.bulkRemove.mutationOptions());

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
      toast.success(`Deleted ${count} ${count === 1 ? "chat" : "chats"}`);
      clearSelection();
      onClose();
      await queryClient.invalidateQueries(trpc.chat.pathFilter());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete these chats",
      );
    }
  };

  if (!items) return null;

  const count = items.length;

  return (
    <Modal
      open={ids !== null}
      onOpenChange={handleOpenChange}
      title={`Delete ${count} ${count === 1 ? "chat" : "chats"}?`}
      description="The conversations and everything said in them are removed. Your documents are untouched. This cannot be undone."
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
