"use client";

import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Folder as FolderIcon, FolderLock } from "lucide-react";

import { DriveActionsShield } from "@/features/main/components/drive-actions-shield";
import { DriveItemActions } from "@/features/main/components/drive-item-actions";
import {
  type SelectRow,
  useDriveRowInteraction,
} from "@/features/main/hooks/use-drive-row-interaction";
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

/**
 * A folder in grid view: a pill with its name and its menu.
 *
 * The same gestures as the row — click to select, double-click to open, hold to
 * select on touch, drag to move — because they come from the same hook. Only
 * the shape differs.
 */
export function DriveFolderCard({
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

  const cardProps = useDriveRowInteraction({
    item: { kind: "folder", id: folder.id },
    isDragging,
    onOpen: () => openFolder({ id: folder.id, name: folder.name }),
    onSelect,
  });

  return (
    <div
      ref={(node) => {
        dragRef(node);
        dropRef(node);
      }}
      {...cardProps}
      role="option"
      aria-selected={isSelected}
      className={cn(
        // The border is transparent until it is needed, so selecting a card
        // outlines it without nudging the grid a pixel.
        "flex select-none items-center gap-3 rounded-xl border border-transparent bg-input/20 px-3 py-3 transition-colors",
        "hover:bg-input/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "border-primary bg-muted",
        isDragging && "cursor-grabbing",
        (isDragging || (isSelected && isDraggingSelection)) && "opacity-40",
        isDropTarget && !isDragging && "border-primary bg-accent",
      )}
    >
      {folder.isLocked ? (
        <FolderLock className="size-5 shrink-0 text-primary" />
      ) : (
        <FolderIcon className="size-5 shrink-0 fill-foreground text-primary" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {folder.name}
      </span>
      <DriveActionsShield>
        <DriveItemActions kind="folder" item={folder} />
      </DriveActionsShield>
    </div>
  );
}
