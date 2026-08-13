"use client";

import { useDroppable } from "@dnd-kit/react";
import { CornerUpLeft } from "lucide-react";

import {
  DRAG_TYPE,
  DROPPABLE_ACCEPTS,
  dropId,
  type DriveDropData,
} from "@/features/main/types";
import { useDriveStore } from "@/lib/stores/drive-store";
import { cn } from "@/lib/utils";

/**
 * Grid view's way back out of a folder — and, as with the row it replaces, the
 * only drop target for the parent, which has no card of its own down here.
 */
export function DriveParentCard({
  parentFolderId,
}: {
  parentFolderId: string | null;
}) {
  const goToCrumb = useDriveStore((state) => state.goToCrumb);

  const { ref, isDropTarget } = useDroppable({
    id: dropId(parentFolderId),
    type: DRAG_TYPE.folder,
    accept: DROPPABLE_ACCEPTS,
    data: { folderId: parentFolderId } satisfies DriveDropData,
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => goToCrumb(parentFolderId)}
      className={cn(
        "flex w-fit select-none items-center gap-2 rounded-xl border border-transparent bg-muted/60 px-3 py-2 text-sm text-muted-foreground transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDropTarget && "border-primary bg-accent text-foreground",
      )}
    >
      <CornerUpLeft className="size-4" />
      Back
    </button>
  );
}
