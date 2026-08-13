"use client";

import { FolderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useModalStore } from "@/lib/stores/modal-store";

export function DriveEmptyState({ isRoot }: { isRoot: boolean }) {
  const openModal = useModalStore((state) => state.open);

  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderIcon />
        </EmptyMedia>
        <EmptyTitle>{isRoot ? "No files yet" : "This folder is empty"}</EmptyTitle>
        <EmptyDescription>
          Upload a file to start studying, or drag files in from another folder.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => openModal("upload-file")}>Upload file</Button>
      </EmptyContent>
    </Empty>
  );
}
