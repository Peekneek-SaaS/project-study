"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useDriveSelectionStore } from "@/lib/stores/drive-selection-store";
import { useDriveNavigation } from "@/features/main/hooks/use-drive-navigation";
import { selectDeleteSelection, useModalStore } from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";

/** "2 folders and 1 file", skipping whichever half is empty. */
function describe(folders: number, documents: number) {
  const parts: string[] = [];
  if (folders > 0) parts.push(`${folders} ${folders === 1 ? "folder" : "folders"}`);
  if (documents > 0) parts.push(`${documents} ${documents === 1 ? "file" : "files"}`);
  return parts.join(" and ");
}

/**
 * Confirms deleting everything ticked in the table.
 *
 * Separate from `DeleteModal` rather than folded into it: that one is built
 * around a single named target, and the counts, the copy and the selection to
 * clear afterwards all differ here.
 */
export function BulkDeleteModal() {
  const selection = useModalStore(selectDeleteSelection);
  const closeModal = useModalStore((state) => state.close);
  const { leaveFolder } = useDriveNavigation();
  const clearSelection = useDriveSelectionStore((state) => state.clear);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const bulkRemove = useMutation(trpc.folder.bulkRemove.mutationOptions());

  // Closing clears the payload, so the last one is held to keep the copy in
  // place while the dialog animates out — same reason as `DeleteModal`.
  const [lastSelection, setLastSelection] = useState(selection);
  if (selection && selection !== lastSelection) setLastSelection(selection);
  const items = selection ?? lastSelection;

  const handleOpenChange = (open: boolean) => {
    if (open || bulkRemove.isPending) return;
    closeModal();
  };

  const handleDelete = async () => {
    if (!selection || bulkRemove.isPending) return;

    try {
      const result = await bulkRemove.mutateAsync(selection);

      toast.success(
        `Deleted ${describe(result.folders, result.documents)}`.trim(),
      );
      // A deleted folder may have been on the trail, or an ancestor of it.
      for (const id of selection.folderIds) leaveFolder(id);
      clearSelection();
      closeModal();
      // Contents, breadcrumb and the move-to tree all just went stale.
      await queryClient.invalidateQueries(trpc.folder.pathFilter());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete these items",
      );
    }
  };

  if (!items) return null;

  const summary = describe(items.folderIds.length, items.documentIds.length);
  const hasFolders = items.folderIds.length > 0;

  return (
    <Modal
      open={selection !== null}
      onOpenChange={handleOpenChange}
      title={`Delete ${summary}?`}
      description={
        hasFolders
          ? "Folders go with everything inside them — subfolders and their files, in your drive and in storage. This cannot be undone."
          : "The files are removed from your drive and from storage. This cannot be undone."
      }
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
