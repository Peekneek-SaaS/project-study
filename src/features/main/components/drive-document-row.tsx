"use client";

import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/react";
import { FileText, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { DriveItemActions } from "@/features/main/components/drive-item-actions";
import { DriveRowActions } from "@/features/main/components/drive-row-actions";
import { DriveStatusBadge } from "@/features/main/components/drive-status-badge";
import { useOpenDocument } from "@/features/main/hooks/use-open-document";
import { formatDriveDate } from "@/features/main/lib/format-drive-date";
import {
  DRAG_TYPE,
  dragId,
  type DriveDocument,
  type DriveDragData,
} from "@/features/main/types";
import { cn } from "@/lib/utils";

export function DriveDocumentRow({ doc }: { doc: DriveDocument }) {
  const openDocument = useOpenDocument();

  const { ref, isDragging } = useDraggable({
    id: dragId({ kind: "document", id: doc.id }),
    type: DRAG_TYPE.document,
    data: { kind: "document", id: doc.id } satisfies DriveDragData,
  });

  const isReady = doc.status === "READY";

  // dnd-kit calls preventDefault on the click that ends a drag, which stops the
  // browser default but not React's handler — so track the gesture ourselves or
  // dropping a document elsewhere would also open it.
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  return (
    <TableRow
      ref={ref}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onClick={() => {
        if (isDragging || dragged.current) return;
        openDocument(doc);
      }}
      className={cn(
        "cursor-grab",
        isDragging && "cursor-grabbing opacity-40",
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
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
          variant={isReady ? "default" : "secondary"}
          disabled={!isReady}
          onClick={() => openDocument(doc)}
          aria-label={`Open ${doc.name}`}
        >
          <Play className="size-4" />
        </Button>

        <DriveItemActions kind="document" item={doc} />
      </DriveRowActions>
    </TableRow>
  );
}
