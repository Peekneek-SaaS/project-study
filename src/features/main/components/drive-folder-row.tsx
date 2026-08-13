"use client";

import { useEffect, useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Folder as FolderIcon } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { DriveItemActions } from "@/features/main/components/drive-item-actions";
import { DriveRowActions } from "@/features/main/components/drive-row-actions";
import { formatDriveDate } from "@/features/main/lib/format-drive-date";
import {
  DRAG_TYPE,
  DROPPABLE_ACCEPTS,
  dragId,
  dropId,
  type DriveDragData,
  type DriveDropData,
  type DriveFolder,
} from "@/features/main/types";
import { useDriveStore } from "@/lib/stores/drive-store";
import { cn } from "@/lib/utils";

export function DriveFolderRow({ folder }: { folder: DriveFolder }) {
  const openFolder = useDriveStore((state) => state.openFolder);

  // A folder is both something you can pick up and somewhere you can drop it.
  const { ref: dragRef, isDragging } = useDraggable({
    id: dragId({ kind: "folder", id: folder.id }),
    type: DRAG_TYPE.folder,
    data: { kind: "folder", id: folder.id } satisfies DriveDragData,
  });

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: dropId(folder.id),
    type: DRAG_TYPE.folder,
    accept: DROPPABLE_ACCEPTS,
    data: { folderId: folder.id } satisfies DriveDropData,
  });

  // dnd-kit calls preventDefault on the click that ends a drag, which stops the
  // browser default but not React's handler — so track the gesture ourselves or
  // dropping a folder elsewhere would also navigate into it.
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  return (
    <TableRow
      ref={(node) => {
        dragRef(node);
        dropRef(node);
      }}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onClick={() => {
        if (isDragging || dragged.current) return;
        openFolder({ id: folder.id, name: folder.name });
      }}
      className={cn(
        "cursor-pointer",
        isDragging && "opacity-40",
        isDropTarget && !isDragging && "bg-accent ring-1 ring-primary ring-inset",
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.name}</span>
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="text-muted-foreground">
        {formatDriveDate(folder.updatedAt)}
      </TableCell>
      <DriveRowActions>
        <DriveItemActions kind="folder" item={folder} />
      </DriveRowActions>
    </TableRow>
  );
}
