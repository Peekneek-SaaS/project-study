"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDriveNavigation } from "@/features/main/hooks/use-drive-navigation";
import { selectIsOpen, useModalStore } from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";

/**
 * Names a folder, makes it, and walks into it.
 *
 * The walking-in is done here rather than in the router, because "which folder
 * is open" is a URL the browser owns — see `useDriveNavigation` — and a
 * procedure has no way to move it. What the procedure does supply is the row it
 * just wrote, which is everything this needs to go there.
 */
export function CreateFolderModal() {
  const isOpen = useModalStore(selectIsOpen("create-folder"));
  const closeModal = useModalStore((state) => state.close);
  const { folderId: parentId, openFolder } = useDriveNavigation();

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const createFolder = useMutation(
    trpc.folder.create.mutationOptions({
      onSuccess: async (folder) => {
        toast.success(`Created ${folder.name}`);
        handleOpenChange(false);

        // One call, which now does both halves: on the drive it moves the
        // `folder` param and nothing else is disturbed, so a filter sitting in
        // the query string survives; from the boards or the notes page there is
        // no param to move, so it navigates to the drive already pointed at the
        // new folder. Either way the crumb names are seeded before the URL
        // changes, so the bar never blinks.
        //
        // This is what makes the dropdown work off the drive too: the folder is
        // created against wherever the drive was left, and now you are taken
        // there to see it.
        openFolder({ id: folder.id, name: folder.name });

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
