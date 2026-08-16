"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DRIVE_PATH } from "@/features/main/types";
import { selectCurrentFolderId, useDriveStore } from "@/lib/stores/drive-store";
import { selectIsOpen, useModalStore } from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";

/**
 * Names a folder, makes it, and walks into it.
 *
 * The walking-in is done here rather than in the router, because "which folder
 * is open" is not something the server knows: it is the trail in `drive-store`,
 * and a procedure has no way to move it. What the procedure does supply is the
 * row it just wrote, which is everything this needs to go there.
 */
export function CreateFolderModal() {
  const isOpen = useModalStore(selectIsOpen("create-folder"));
  const closeModal = useModalStore((state) => state.close);
  const parentId = useDriveStore(selectCurrentFolderId);
  const openFolder = useDriveStore((state) => state.openFolder);

  const router = useRouter();
  const pathname = usePathname();

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const createFolder = useMutation(
    trpc.folder.create.mutationOptions({
      onSuccess: async (folder) => {
        toast.success(`Created ${folder.name}`);
        handleOpenChange(false);

        // The trail moves first, then the page. Both halves are needed and the
        // order is what keeps the transition clean: with the trail already
        // pointing at the new folder, the drive's first render is of that
        // folder rather than of the old listing for a frame before it catches
        // up. Pushing is skipped when we are already on the drive, so a filter
        // sitting in the query string is not thrown away by a redundant
        // navigation.
        //
        // This is what makes the dropdown work from the boards and notes pages
        // too: the folder is created against wherever the drive was left, and
        // now you are taken there to see it.
        openFolder({ id: folder.id, name: folder.name });
        if (pathname !== DRIVE_PATH) router.push(DRIVE_PATH);

        // The whole router: the new folder has to reach the search palette's
        // flat index as well as the listing. Last, because the folder we are
        // now standing in is a listing of its own and does not wait on this —
        // what this refreshes is the parent we just left.
        await queryClient.invalidateQueries(trpc.folder.pathFilter());
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setName("");
    closeModal();
  };

  const trimmed = name.trim();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || createFolder.isPending) return;
    createFolder.mutate({ name: trimmed, parentId });
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="New folder"
      description="Folders are created inside the one you are browsing."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="folder-name">Name</Label>
          <Input
            id="folder-name"
            value={name}
            autoFocus
            maxLength={255}
            placeholder="e.g. Science"
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed || createFolder.isPending}>
            {createFolder.isPending ? "Creating…" : "Create folder"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
