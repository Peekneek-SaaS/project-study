"use client";

import { FileText, Folder as FolderIcon } from "lucide-react";

import type {
  DriveDocument,
  DriveDragData,
  DriveFolder,
} from "@/features/main/types";
import { useDriveSelectionStore } from "@/lib/stores/drive-selection-store";

/** Names beyond this are counted rather than listed. */
const PREVIEW_LIMIT = 3;

interface PreviewItem {
  id: string;
  name: string;
  kind: "folder" | "document";
}

/**
 * What rides with the pointer during a drag.
 *
 * dnd-kit's default feedback is a clone of the row you grabbed, which can only
 * ever show one thing — a selection of five looked exactly like a selection of
 * one. Registering this through `DragOverlay` replaces that clone, so the drag
 * shows everything it is actually carrying.
 */
export function DriveDragPreview({
  drag,
  folders,
  documents,
}: {
  drag: DriveDragData;
  folders: DriveFolder[];
  documents: DriveDocument[];
}) {
  const folderIds = useDriveSelectionStore((state) => state.folderIds);
  const documentIds = useDriveSelectionStore((state) => state.documentIds);

  const isSelected =
    drag.kind === "folder" ? folderIds.has(drag.id) : documentIds.has(drag.id);
  const carriesSelection = isSelected && folderIds.size + documentIds.size > 1;

  // Read off the listing, so the preview names things in the order the table
  // does — and so a ticked row that has since gone never shows up here.
  const items: PreviewItem[] = carriesSelection
    ? [
        ...folders
          .filter((folder) => folderIds.has(folder.id))
          .map(({ id, name }) => ({ id, name, kind: "folder" as const })),
        ...documents
          .filter((doc) => documentIds.has(doc.id))
          .map(({ id, name }) => ({ id, name, kind: "document" as const })),
      ]
    : (() => {
        const one =
          drag.kind === "folder"
            ? folders.find((folder) => folder.id === drag.id)
            : documents.find((doc) => doc.id === drag.id);
        return one ? [{ id: one.id, name: one.name, kind: drag.kind }] : [];
      })();

  if (items.length === 0) return null;

  const shown = items.slice(0, PREVIEW_LIMIT);
  const rest = items.length - shown.length;

  return (
    <div className="relative w-fit max-w-64 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-lg">
      <div className="flex flex-col gap-1">
        {shown.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            {item.kind === "folder" ? (
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{item.name}</span>
          </div>
        ))}
        {rest > 0 && (
          <span className="pl-5.5 text-[0.625rem] text-muted-foreground">
            +{rest} more
          </span>
        )}
      </div>

      {items.length > 1 && (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-primary text-[0.625rem] font-medium text-primary-foreground">
          {items.length}
        </span>
      )}
    </div>
  );
}
