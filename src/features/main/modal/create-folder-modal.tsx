"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectCurrentFolderId, useDriveStore } from "@/lib/stores/drive-store";
import { selectIsOpen, useModalStore } from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";

export function CreateFolderModal() {
  const isOpen = useModalStore(selectIsOpen("create-folder"));
  const closeModal = useModalStore((state) => state.close);
  const parentId = useDriveStore(selectCurrentFolderId);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const createFolder = useMutation(
    trpc.folder.create.mutationOptions({
      onSuccess: async (folder) => {
        toast.success(`Created ${folder.name}`);
        handleOpenChange(false);
        // The whole router: the new folder has to reach the search palette's
        // flat index as well as the listing.
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
