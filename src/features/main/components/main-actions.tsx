"use client";

import { FolderPlus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useModalStore } from "@/lib/stores/modal-store";

/**
 * Toolbar buttons. Split out of `MainView` so the view stays a Server
 * Component — these only need the click handlers.
 */
export function MainActions() {
  const openModal = useModalStore((state) => state.open);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => openModal("create-folder")}>
        <FolderPlus className="size-4" />
        New folder
      </Button>
      <Button onClick={() => openModal("upload-file")}>
        <Upload className="size-4" />
        Upload file
      </Button>
    </div>
  );
}
