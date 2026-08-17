"use client";

import { motion } from "motion/react";

import { useDraggable } from "@dnd-kit/react";
import {
  ExternalLink,
  FileLock,
  FileText,
  Play,
  Presentation,
} from "lucide-react";

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
import { listItem } from "@/lib/motion";
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

  const cardProps = useDriveRowInteraction({
    item: { kind: "document", id: doc.id },
    isDragging,
    // The work page, matching the row — see `drive-document-row`.
    onOpen: () => open(doc),
    onSelect,
  });

  const isReady = doc.status === "READY";

  // const Icon = doc.isLocked
  //   ? FileLock
  //   : isSlides(doc.name)
  //     ? Presentation
  //     : FileText;

  return (
    <motion.div
      variants={listItem}
      ref={ref}
      {...cardProps}
      role="option"
      aria-selected={isSelected}
      className={cn(
        "flex select-none flex-col overflow-hidden rounded-xl bg-input/20 transition-colors border dark:hover:bg-muted",
        "hover:bg-input/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
        isDragging && "cursor-grabbing",
        (isDragging || (isSelected && isDraggingSelection)) && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <FileText className="size-5 shrink-0 fill-orange-400 stroke-orange-200" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {doc.name}
        </span>
        <DriveActionsShield className="gap-1">
          <Button
            size="icon"
            variant={isReady ? "ghost" : "secondary"}
            disabled={!isReady}
            onClick={() => preview(doc)}
            aria-label={`Preview ${doc.name}`}
          >
            <ExternalLink className="size-4" />
          </Button>
          <DriveItemActions kind="document" item={doc} />
        </DriveActionsShield>
      </div>

      <div className="relative mx-2 mb-2 h-44 overflow-hidden rounded-lg bg-background">
        <DocumentThumbnail doc={doc} />
        {doc.overallStatus !== "READY" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <DriveStatusBadge status={doc.overallStatus} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
