"use client";

import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Folder as FolderIcon, FolderLock } from "lucide-react";

import { MotionTableRow } from "@/components/motion/motion-table";
import { TableCell } from "@/components/ui/table";
import { listItem } from "@/lib/motion";
import { DriveItemActions } from "@/features/main/components/drive-item-actions";
import { DriveRowActions } from "@/features/main/components/drive-row-actions";
import {
  type SelectRow,
  useDriveRowInteraction,
} from "@/features/main/hooks/use-drive-row-interaction";
import { formatDriveDate } from "@/features/main/lib/format-drive-date";
import {
  DROP_TARGET_ROW_CLASS,
  SELECTED_ROW_CLASS,
} from "@/features/main/lib/drive-row-classes";
import {
  DRAG_TYPE,
  DROPPABLE_ACCEPTS,
  dragId,
  dropId,
  type DriveDragData,
  type DriveDropData,
  type DriveFolder,
} from "@/features/main/types";
import {
  selectIsFolderSelected,
  useDriveSelectionStore,
} from "@/lib/stores/drive-selection-store";
import { useDriveStore } from "@/lib/stores/drive-store";
import { cn } from "@/lib/utils";

export function DriveFolderRow({
  folder,
  onSelect,
}: {
  folder: DriveFolder;
  onSelect: SelectRow;
}) {
  const openFolder = useDriveStore((state) => state.openFolder);

  const isSelected = useDriveSelectionStore(selectIsFolderSelected(folder.id));
  const isDraggingSelection = useDriveSelectionStore(
    (state) => state.isDraggingSelection,
  );

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

  const rowProps = useDriveRowInteraction({
    item: { kind: "folder", id: folder.id },
    isDragging,
    onOpen: () => openFolder({ id: folder.id, name: folder.name }),
    onSelect,
  });

  return (
    <MotionTableRow
      variants={listItem}
      ref={(node) => {
        dragRef(node);
        dropRef(node);
      }}
      {...rowProps}
      aria-selected={isSelected}
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        // `select-none` so the double-click that opens a folder does not leave
        // its name highlighted behind the folder you just walked into.
        "cursor-default select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-input/50",
        SELECTED_ROW_CLASS,
        isDragging && "cursor-grabbing",
        // Dimmed while held, and while the rest of the selection it belongs to
        // is being carried somewhere.
        (isDragging || (isSelected && isDraggingSelection)) && "opacity-40",
        isDropTarget && !isDragging && DROP_TARGET_ROW_CLASS,
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {/* {folder.isLocked ? (
            <FolderLock className="size-4 shrink-0 fill-primary stroke-primary" />
          ) : (
            <FolderIcon className="size-4 shrink-0 fill-primary stroke-primary" />
          )} */}
          <FolderIcon className="size-4 shrink-0 fill-primary stroke-primary" />

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
    </MotionTableRow>
  );
}
