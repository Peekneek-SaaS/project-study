"use client";

import { useDraggable } from "@dnd-kit/react";
import { FileLock, FileText, Play, Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DocumentThumbnail } from "@/features/main/components/document-thumbnail";
import { DriveActionsShield } from "@/features/main/components/drive-actions-shield";
import { DriveItemActions } from "@/features/main/components/drive-item-actions";
import { DriveStatusBadge } from "@/features/main/components/drive-status-badge";
import {
  type SelectRow,
  useDriveRowInteraction,
} from "@/features/main/hooks/use-drive-row-interaction";
import { useOpenDocument } from "@/features/main/hooks/use-open-document";
import {
  DRAG_TYPE,
  dragId,
  type DriveDocument,
  type DriveDragData,
} from "@/features/main/types";
import { isSlides } from "@/lib/document-file-types";
import {
  selectIsDocumentSelected,
  useDriveSelectionStore,
} from "@/lib/stores/drive-selection-store";
import { cn } from "@/lib/utils";

/**
 * A document in grid view: its name, its menu, and a look at the thing itself.
 *
 * The preview is the point of this view — a wall of identical file icons tells
 * you nothing a list would not have told you faster.
 */
export function DriveDocumentCard({
  doc,
  onSelect,
}: {
  doc: DriveDocument;
  onSelect: SelectRow;
}) {
  const openDocument = useOpenDocument();

  const isSelected = useDriveSelectionStore(selectIsDocumentSelected(doc.id));
  const isDraggingSelection = useDriveSelectionStore(
    (state) => state.isDraggingSelection,
  );

  const { ref, isDragging } = useDraggable({
    id: dragId({ kind: "document", id: doc.id }),
    type: DRAG_TYPE.document,
    data: { kind: "document", id: doc.id } satisfies DriveDragData,
  });

  const cardProps = useDriveRowInteraction({
    item: { kind: "document", id: doc.id },
    isDragging,
    onOpen: () => openDocument(doc),
    onSelect,
  });

  const isReady = doc.status === "READY";

  const Icon = doc.isLocked
    ? FileLock
    : isSlides(doc.name)
      ? Presentation
      : FileText;

  return (
    <div
      ref={ref}
      {...cardProps}
      role="option"
      aria-selected={isSelected}
      className={cn(
        // The border is transparent until it is needed, so selecting a card
        // outlines it without nudging the grid a pixel.
        "flex select-none flex-col overflow-hidden rounded-xl border border-transparent bg-muted/60 transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "border-primary bg-muted",
        isDragging && "cursor-grabbing",
        (isDragging || (isSelected && isDraggingSelection)) && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {doc.name}
        </span>
        <DriveActionsShield className="gap-1">
          <Button
            size="icon-sm"
            variant={isReady ? "default" : "secondary"}
            disabled={!isReady}
            onClick={() => openDocument(doc)}
            aria-label={`Open ${doc.name}`}
          >
            <Play className="size-3.5" />
          </Button>
          <DriveItemActions kind="document" item={doc} />
        </DriveActionsShield>
      </div>

      <div className="relative mx-2 mb-2 h-44 overflow-hidden rounded-lg bg-background">
        <DocumentThumbnail doc={doc} />
        {doc.status !== "READY" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <DriveStatusBadge status={doc.status} />
          </div>
        )}
      </div>
    </div>
  );
}
