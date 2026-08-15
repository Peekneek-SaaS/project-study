"use client";

import { useEffect } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DriveDocumentRow } from "@/features/main/components/drive-document-row";
import { DriveDragPreview } from "@/features/main/components/drive-drag-preview";
import { DriveEmptyState } from "@/features/main/components/drive-empty-state";
import { DriveFolderRow } from "@/features/main/components/drive-folder-row";
import { DriveGrid } from "@/features/main/components/drive-grid";
import { DriveParentRow } from "@/features/main/components/drive-parent-row";
import { useDriveBrowser } from "@/features/main/hooks/use-drive-browser";
import { useDriveRowSelection } from "@/features/main/hooks/use-drive-row-selection";
import { driveSensors } from "@/features/main/lib/drive-sensors";
import type { DriveDragData } from "@/features/main/types";
import { useDriveSelectionStore } from "@/lib/stores/drive-selection-store";
import {
  type DriveViewType,
  useDriveView,
} from "@/lib/stores/drive-view-store";
import { useModalStore } from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainSelectFilter from "./main-select-filters";
import MainFilterView from "../views/main-filter-view";

export function MainContent({ serverView }: { serverView: DriveViewType }) {
  const {
    folders,
    documents,
    currentFolderId,
    parentFolderId,
    handleDragStart,
    handleDragEnd,
    isMoving,
  } = useDriveBrowser();

  const openModal = useModalStore((state) => state.open);
  const selectedFolderIds = useDriveSelectionStore((state) => state.folderIds);
  const selectedDocumentIds = useDriveSelectionStore(
    (state) => state.documentIds,
  );
  const clearSelection = useDriveSelectionStore((state) => state.clear);
  const view = useDriveView(serverView);

  // Click to select, double-click to open; ⌘/ctrl, shift and the arrow keys do
  // the rest, and the hook binds those keys for as long as the table is up.
  const { selectRow, selectAll } = useDriveRowSelection(folders, documents);

  // A selection describes one listing, so walking into a folder ends it.
  useEffect(() => {
    clearSelection();
  }, [currentFolderId, clearSelection]);

  const isRoot = currentFolderId === null;
  const hasItems = folders.length > 0 || documents.length > 0;

  // What is on screen decides. Rows can go out from under a selection — deleted
  // from their own menu, dragged into another folder — and reading the ticks
  // back off the listing keeps a stale id out of the count and off the request.
  const selectedFolders = folders
    .filter((folder) => selectedFolderIds.has(folder.id))
    .map((folder) => folder.id);
  const selectedDocuments = documents
    .filter((doc) => selectedDocumentIds.has(doc.id))
    .map((doc) => doc.id);

  const selectedCount = selectedFolders.length + selectedDocuments.length;
  const allSelected =
    hasItems && selectedCount === folders.length + documents.length;

  return (
    <DragDropProvider
      sensors={driveSensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        // Clicking past the rows drops the selection, the way clicking empty
        // space in a file manager does. Rows handle their own clicks and never
        // reach this.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("tr")) return;
          clearSelection();
        }}
        className={cn(isMoving && "pointer-events-none opacity-60")}
      >
        <div className="flex items-center gap-2 w-full">
          {selectedCount > 0 ? (
            <div className="flex items-center justify-between gap-3 px-3 bg-muted/40 py-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X />
                </Button>
                <span className="text-sm">
                  {selectedCount} {selectedCount === 1 ? "item" : "items"}{" "}
                  selected
                </span>
                {/* The old header tick was the only way to reach everything at
                  once; with it gone, this and ⌘A are. */}
                {!allSelected && (
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    Select all
                  </Button>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  openModal("delete-items", {
                    folderIds: selectedFolders,
                    documentIds: selectedDocuments,
                  })
                }
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          ) : (
            <MainFilterView />
          )}
        </div>

        {/* TODO: Faded Overlay */}
        {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" /> */}

        {view === "grid" ? (
          <DriveGrid
            folders={folders}
            documents={documents}
            isRoot={isRoot}
            parentFolderId={parentFolderId}
            onSelect={selectRow}
          />
        ) : (
          <Table>
            {hasItems && (
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {!isRoot && <DriveParentRow parentFolderId={parentFolderId} />}
              {folders.map((folder) => (
                <DriveFolderRow
                  key={folder.id}
                  folder={folder}
                  onSelect={selectRow}
                />
              ))}
              {documents.map((doc) => (
                <DriveDocumentRow key={doc.id} doc={doc} onSelect={selectRow} />
              ))}
            </TableBody>
          </Table>
        )}
        {!hasItems && <DriveEmptyState isRoot={isRoot} />}
      </div>

      {/*
        Registering an overlay takes dnd-kit off its default feedback — the
        cloned row — and leaves the real row in place, dimmed, rather than
        swapping in a placeholder.
      */}
      <DragOverlay>
        {(source) => {
          const drag = source.data as DriveDragData | undefined;
          if (!drag) return null;
          return (
            <DriveDragPreview
              drag={drag}
              folders={folders}
              documents={documents}
            />
          );
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
