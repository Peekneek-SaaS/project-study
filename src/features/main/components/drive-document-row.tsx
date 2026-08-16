"use client";

import { useDraggable } from "@dnd-kit/react";
import { FileLock, FileText, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MotionTableRow } from "@/components/motion/motion-table";
import { TableCell } from "@/components/ui/table";
import { listItem } from "@/lib/motion";
import { DriveItemActions } from "@/features/main/components/drive-item-actions";
import { DriveRowActions } from "@/features/main/components/drive-row-actions";
import { DriveStatusBadge } from "@/features/main/components/drive-status-badge";
import {
  type SelectRow,
  useDriveRowInteraction,
} from "@/features/main/hooks/use-drive-row-interaction";
import { useOpenDocument } from "@/features/main/hooks/use-open-document";
import { SELECTED_ROW_CLASS } from "@/features/main/lib/drive-row-classes";
import { formatDriveDate } from "@/features/main/lib/format-drive-date";
import {
  DRAG_TYPE,
  dragId,
  type DriveDocument,
  type DriveDragData,
} from "@/features/main/types";
import {
  selectIsDocumentSelected,
  useDriveSelectionStore,
} from "@/lib/stores/drive-selection-store";
import { cn } from "@/lib/utils";

export function DriveDocumentRow({
  doc,
  onSelect,
}: {
  doc: DriveDocument;
  onSelect: SelectRow;
}) {
  const { open, preview } = useOpenDocument();

  const isSelected = useDriveSelectionStore(selectIsDocumentSelected(doc.id));
  const isDraggingSelection = useDriveSelectionStore(
    (state) => state.isDraggingSelection,
  );

  const { ref, isDragging } = useDraggable({
    id: dragId({ kind: "document", id: doc.id }),
    type: DRAG_TYPE.document,
    data: { kind: "document", id: doc.id } satisfies DriveDragData,
  });

  const isReady = doc.status === "READY";

  const rowProps = useDriveRowInteraction({
    item: { kind: "document", id: doc.id },
    isDragging,
    // Double-click goes to the work page now, not the preview modal — the
    // document beside its board and its notes.
    onOpen: () => open(doc),
    onSelect,
  });

  return (
    <MotionTableRow
      variants={listItem}
      ref={ref}
      {...rowProps}
      aria-selected={isSelected}
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        // `select-none` so double-clicking to open does not leave the file name
        // highlighted underneath the preview.
        "cursor-default select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-input/50",
        SELECTED_ROW_CLASS,
        isDragging && "cursor-grabbing",
        // Dimmed while held, and while the rest of the selection it belongs to
        // is being carried somewhere.
        (isDragging || (isSelected && isDraggingSelection)) && "opacity-40",
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {doc.isLocked ? (
            <FileLock className="size-4 shrink-0 text-orange-400" />
          ) : (
            <FileText className="size-4 shrink-0 text-orange-400" />
          )}
          <span className="truncate">{doc.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <DriveStatusBadge status={doc.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDriveDate(doc.updatedAt)}
      </TableCell>
      <DriveRowActions>
        <Button
          size="icon"
          variant={isReady ? "ghost" : "secondary"}
          disabled={!isReady}
          // The quick look, kept on the play button now that the double-click
          // has been given to the work page.
          onClick={() => preview(doc)}
          aria-label={`Preview ${doc.name}`}
          className={cn("")}
        >
          <Play className="size-4 fill-emerald-400 stroke-emerald-400" />
        </Button>

        <DriveItemActions kind="document" item={doc} />
      </DriveRowActions>
    </MotionTableRow>
  );
}
