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
import { Button } from "@/components/ui/button";

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
    <Button
      ref={ref}
      onClick={() => goToCrumb(parentFolderId)}
      className={cn(
        "w-fit",
        isDropTarget && "border-primary bg-accent text-foreground",
      )}
    >
      <CornerUpLeft className="size-3.5" />
      Back
    </Button>
  );
}
