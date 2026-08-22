"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useDriveNavigation } from "@/features/main/hooks/use-drive-navigation";
import { selectDeleteTarget, useModalStore } from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";
import { Trash } from "lucide-react";

const DESCRIPTION = {
  document:
    "The file is removed from your drive and from storage. This cannot be undone.",
  folder:
    "The folder goes with everything inside it — subfolders and their files, in your drive and in storage. This cannot be undone.",
} as const;

/**
 * Confirms deleting a document or a folder.
 *
 * One modal for both because the copy is all that differs; the target arrives
 * on the `open("delete-item", …)` payload, so a row can ask for the
 * confirmation and then unmount without taking the dialog with it.
 */
export function DeleteModal() {
  const target = useModalStore(selectDeleteTarget);
  const closeModal = useModalStore((state) => state.close);
  const { leaveFolder } = useDriveNavigation();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const removeDocument = useMutation(trpc.document.remove.mutationOptions());
  const removeFolder = useMutation(trpc.folder.remove.mutationOptions());
  const isPending = removeDocument.isPending || removeFolder.isPending;

  // Closing clears the payload, so hold onto the last one: it keeps the copy in
  // place while the dialog animates out instead of blanking mid-transition.
  const [lastTarget, setLastTarget] = useState(target);
  if (target && target !== lastTarget) setLastTarget(target);
  const item = target ?? lastTarget;

  const handleOpenChange = (open: boolean) => {
    if (open || isPending) return;
    closeModal();
  };

  const handleDelete = async () => {
    if (!target || isPending) return;
    const { kind, id, name } = target;

    try {
      if (kind === "document") await removeDocument.mutateAsync({ id });
      else await removeFolder.mutateAsync({ id });

      toast.success(`Deleted ${name}`);
      // No-op unless the folder was on the trail, which beats browsing into a
      // breadcrumb that no longer exists. Steps out to its parent, so deleting
      // a subfolder leaves you where you were rather than at the root.
      if (kind === "folder") leaveFolder(id);
      closeModal();
      // Contents, breadcrumb and the move-to tree all just went stale.
      await queryClient.invalidateQueries(trpc.folder.pathFilter());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not delete ${name}`,
      );
    }
  };

  if (!item) return null;

  return (
    <Modal
      open={target !== null}
      onOpenChange={handleOpenChange}
      title={`Delete ${item.name}?`}
      description={DESCRIPTION[item.kind]}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={handleDelete}
        >
          {isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
