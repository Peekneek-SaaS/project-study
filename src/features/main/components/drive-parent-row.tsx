"use client";

import { useDroppable } from "@dnd-kit/react";
import { CornerLeftUp, CornerUpLeft } from "lucide-react";

import { MotionTableRow } from "@/components/motion/motion-table";
import { TableCell } from "@/components/ui/table";
import { listItem } from "@/lib/motion";
import { DROP_TARGET_ROW_CLASS } from "@/features/main/lib/drive-row-classes";
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
 * The way back out of a folder — and the only drop target for the parent, which
 * has no row of its own down here.
 */
export function DriveParentRow({
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
    <MotionTableRow
      variants={listItem}
      ref={ref}
      onClick={() => goToCrumb(parentFolderId)}
      className={cn(
        // A way out rather than a row you can hold: one click, as with any
        // other button on the page.
        "cursor-pointer text-muted-foreground select-none py-2",
        isDropTarget && DROP_TARGET_ROW_CLASS,
      )}
    >
      <TableCell colSpan={4}>
        <Button className="flex items-center gap-2 space-y-2">
          <CornerUpLeft className="size-3.5 shrink-0" />
          Back
        </Button>
      </TableCell>
    </MotionTableRow>
  );
}
