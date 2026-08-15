"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useNoteSelectionStore } from "@/lib/stores/note-selection-store";
import { useTRPC } from "@/trpc/client";

/** Confirms deleting every note ticked on the wall. */
export function DeleteNotesDialog({
  ids,
  onClose,
}: {
  /** The ticked notes, or `null` when the dialog is not up. */
  ids: string[] | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const clearSelection = useNoteSelectionStore((state) => state.clear);

  const bulkRemove = useMutation(trpc.stickyNote.bulkRemove.mutationOptions());

  // Held past closing so the count stays in the copy while the dialog animates
  // out — the notes it counts are gone by then.
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
      toast.success(`Deleted ${count} ${count === 1 ? "note" : "notes"}`);
      clearSelection();
      onClose();
      await queryClient.invalidateQueries(trpc.stickyNote.pathFilter());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete these notes",
      );
    }
  };

  if (!items) return null;

  const count = items.length;

  return (
    <Modal
      open={ids !== null}
      onOpenChange={handleOpenChange}
      title={`Delete ${count} ${count === 1 ? "note" : "notes"}?`}
      description="The notes and everything written on them are removed. This cannot be undone."
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
