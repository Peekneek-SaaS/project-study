"use client";

import { useEffect, useState } from "react";
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
    isFiltering,
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
  const isSelecting = selectedCount > 0;
  const allSelected =
    hasItems && selectedCount === folders.length + documents.length;

  // The selection bar stays mounted through its own fade-out, so it needs
  // something to say on the way out — reading the live count there would flash
  // "0 items selected" across the fade. So it holds the last count it was
  // shown with, updated during the render that changes it rather than in an
  // effect, which would paint the old number for a frame first.
  const [shownCount, setShownCount] = useState(selectedCount);
  if (isSelecting && shownCount !== selectedCount) setShownCount(selectedCount);

  return (
    <DragDropProvider
      sensors={driveSensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn(isMoving && "pointer-events-none opacity-60")}>
        {/*
          Both bars sit in the one grid cell, stacked, so the header is always
          as tall as the taller of them and the listing underneath never steps
          up or down when a selection starts or ends. They cross-fade in place
          rather than swapping, which is what made this flick: mounting one
          subtree and unmounting the other let the header collapse to nothing
          for a frame in between. `inert` takes the hidden one out of the tab
          order and off the pointer's hit-test the moment it starts to leave,
          so only the live bar can be reached however long the fade runs.
        */}
        <div className="grid w-full grid-cols-1 grid-rows-1 *:col-start-1 *:row-start-1">
          <div
            inert={isSelecting}
            className={cn(
              "transition-[opacity,visibility] duration-150 ease-out",
              isSelecting && "invisible opacity-0",
            )}
          >
            <MainFilterView />
          </div>

          <div
            inert={!isSelecting}
            className={cn(
              "flex w-full items-center justify-between gap-3 bg-input/30 px-3 py-2",
              "transition-[opacity,visibility] duration-150 ease-out",
              !isSelecting && "invisible opacity-0",
            )}
          >
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X />
              </Button>
              {/* `tabular-nums` so counting up does not shuffle everything to
                the right of the number by a fraction of a character. */}
              <span className="text-sm tabular-nums">
                {shownCount} {shownCount === 1 ? "item" : "items"} selected
              </span>
              {/* The old header tick was the only way to reach everything at
                once; with it gone, this and ⌘A are. Hidden rather than
                dropped once everything is picked, so the row either side of
                it stays put. */}
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                inert={allSelected}
                className={cn(allSelected && "invisible")}
              >
                Select all
              </Button>
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
        </div>

        {/*
          The listing runs under the floating breadcrumb bar, so it fades out
          into the page rather than being cut off mid-row behind it. Absolute
          against the view's `relative` wrapper, and drawn before the bar in the
          DOM so the bar stays legible on top of it. `pointer-events-none` keeps
          the rows underneath clickable right up to the bar.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background via-background/80 to-transparent" />

        <div
          // Clicking past the listing drops the selection, the way clicking
          // empty space in a file manager does. Rows and cards both carry
          // `data-drive-row` and answer their own clicks; buttons and menus
          // speak for themselves. Anything else here is background.
          //
          // Wrapped around the listing alone rather than the whole view,
          // because the selection toolbar sits above it — a "Select all" that
          // cleared the selection on the way back up would be worse than none.
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest("[data-drive-row], button, a, [role='menuitem']")
            )
              return;
            clearSelection();
          }}
        >
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
                  <DriveDocumentRow
                    key={doc.id}
                    doc={doc}
                    onSelect={selectRow}
                  />
                ))}
              </TableBody>
            </Table>
          )}
          {!hasItems && (
            <DriveEmptyState isRoot={isRoot} isFiltering={isFiltering} />
          )}
        </div>
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
