"use client";

import { useEffect, useState } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { Trash2, X } from "lucide-react";

import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
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
import { AnimatePresence } from "motion/react";

import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import type { DriveDragData } from "@/features/main/types";
import { useDriveSelectionStore } from "@/lib/stores/drive-selection-store";
import {
  type DriveViewType,
  useDriveView,
} from "@/lib/stores/drive-view-store";
import { useModalStore } from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";
import MainFilterView from "../views/main-filter-view";

/**
 * What keeps a column heading under the toolbar as the rows scroll past it.
 *
 * The offset is every sticky thing above it stacked up — the app header, the
 * title bar, the toolbar — read from the variables `main-view.tsx` declares, so
 * the headings follow the header when the sidebar collapses and shortens it.
 *
 * `md:` on every part of it, and not as a nicety: below that breakpoint the
 * table keeps the `overflow-x-auto` container it ships with, which makes that
 * container the scrollport these would stick to. Sticking to a box that never
 * scrolls vertically does not leave the heading where it was — the scrollport's
 * top *is* the container's top, so the offset is measured from there and the
 * heading gets shoved a full 10rem down into the table, surfacing a few rows
 * in. So this has to be gated to exactly where the overflow is taken off, and
 * the two belong together: see the listing wrapper below.
 *
 * The rule underneath is an inset shadow rather than the `border-b` the table
 * gives its header row. Preflight puts tables in `border-collapse: collapse`,
 * where a border belongs to the table's own grid rather than to the cell, and
 * so stays behind at the row's original place once the cell starts sticking.
 * A shadow is painted by the cell and travels with it.
 */
const STICKY_HEAD =
  "md:sticky md:top-[calc(var(--drive-sticky-top)+var(--drive-title-h)+var(--drive-toolbar-h))] md:z-10 md:bg-background md:shadow-[inset_0_-1px_0_0_var(--border)]";

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
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
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
      {/*
        A flex column that fills what the view gives it, so the empty state can
        centre itself in the space left over rather than sitting just under the
        toolbar. `Empty` already asks for that with `flex-1`; the ask only
        reaches the page if every wrapper between the two passes the height on.
      */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          isMoving && "pointer-events-none opacity-60",
        )}
      >
        {/*
          Both bars sit in the one grid cell, stacked, so the listing underneath
          never steps up or down when a selection starts or ends. They cross-fade
          in place rather than swapping, which is what made this flick: mounting
          one subtree and unmounting the other let the header collapse to nothing
          for a frame in between. `inert` takes the hidden one out of the tab
          order and off the pointer's hit-test the moment it starts to leave,
          so only the live bar can be reached however long the fade runs.

          Sticky under the title bar, so the filters — and, mid-selection, the
          count and the delete — stay reachable however far down the folder you
          are. The offset is the title bar's height added to where the sticky
          region starts; both are declared on the view's root (`main-view.tsx`),
          which is also what makes this follow the header when it shrinks. The
          height is declared rather than measured for the same reason: the
          column headings below stick under this bar and have to name how tall
          it is. `3rem` is the taller of the two bars (the filter row's `h-8`
          selects plus its padding), so neither is cramped by it.

          `z-20` puts it under the title bar rather than over it, and no
          `w-full`: with `-mx-4` pulling the bar out over the page padding, an
          explicit 100% width would measure from the old edge and hang off the
          right instead of stretching to both.
        */}
        <div className="sticky top-[calc(var(--drive-sticky-top)+var(--drive-title-h))] z-20 -mx-4 grid h-(--drive-toolbar-h) grid-cols-1 grid-rows-1 bg-background px-4 *:col-start-1 *:row-start-1">
          <div
            inert={isSelecting}
            className={cn(
              "transition-[opacity,visibility] duration-250 ease-out",
              isSelecting && "invisible opacity-0",
            )}
          >
            <MainFilterView />
          </div>

          <div
            inert={!isSelecting}
            className={cn(
              "flex w-full items-center justify-between gap-3 bg-input/30 px-3 py-2",
              "transition-[opacity,visibility] duration-250 ease-out",
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

        <div
          // What makes the sticky column headings above actually stick. The
          // table ships inside an `overflow-x-auto` container, and a box that
          // scrolls on one axis scrolls on both as far as CSS is concerned —
          // which would make that container the scrollport the headings stick
          // to, and it never scrolls vertically. Taking the overflow off hands
          // them back to the page. Reached through the `data-slot` the table
          // exposes rather than by changing the shared component, and only from
          // `md` up: below that the row is genuinely too wide for the screen
          // and scrolling it sideways is worth more than a pinned heading.
          // `STICKY_HEAD` is gated to the same breakpoint and has to stay that
          // way — a heading left sticky here would be displaced, not ignored.
          // `flex-1` for the same reason as the wrapper above: it carries the
          // height down to the empty state, which centres itself in it.
          className="flex flex-1 flex-col md:[&_[data-slot=table-container]]:overflow-x-visible"
          // Clicking past the listing drops the selection, the way clicking
          // empty space in a file manager does. Rows and cards both carry
          // a row key and answer their own clicks; buttons and menus
          // speak for themselves. Anything else here is background.
          //
          // Wrapped around the listing alone rather than the whole view,
          // because the selection toolbar sits above it — a "Select all" that
          // cleared the selection on the way back up would be worse than none.
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest(`[${ROW_ATTRIBUTE}], button, a, [role='menuitem']`)
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
              // Which listing this is, so the cards' presence can be thrown
              // away on navigation rather than animated out. See the table's
              // own key below.
              listingKey={currentFolderId ?? "root"}
            />
          ) : (
            <Table>
              {hasItems && (
                <TableHeader>
                  <TableRow>
                    <TableHead className={STICKY_HEAD}>Name</TableHead>
                    <TableHead className={STICKY_HEAD}>Status</TableHead>
                    <TableHead className={STICKY_HEAD}>Modified</TableHead>
                    <TableHead className={cn(STICKY_HEAD, "w-24 text-right")}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
              )}
              {/*
                A plain body, with no entrance on it.

                It used to carry a staggered mount, and the stagger was the
                problem rather than the fix: this listing is *replaced* on every
                navigation, so walking into a folder played an arrival on every
                row at once, and walking back out played it again. What should
                feel like a door opening felt like the page loading slowly.

                It has to be removed here as well as on the rows, not instead of
                them. A motion parent propagates its variants to any child that
                does not name its own, so leaving `initial="hidden"` on the body
                would hand the entrance straight back to rows that had just
                stopped asking for one.

                `AnimatePresence` and the rows' `exit` stay. Deleting is
                something that happens to a list you are already looking at, and
                that still deserves to be shown — see the key on it below for
                how the two are told apart.
              */}
              <TableBody>
                {!isRoot && <DriveParentRow parentFolderId={parentFolderId} />}
                {/*
                  Keyed by the folder, which is the other half of removing the
                  entrance.

                  Taking the arrival off the rows was not enough on its own: a
                  navigation replaces every key in this list, so the *outgoing*
                  folder's rows were still being played out — shrinking away
                  while the new ones appeared underneath them. Half the movement
                  being complained about was the folder being left, not the one
                  being opened.

                  A key here makes React throw the whole `AnimatePresence` away
                  and build a new one, and a presence component that is itself
                  unmounted has no chance to animate its children out. So
                  navigation is an instant swap, while a delete *within* a
                  folder — same key, one child gone — still plays its exit.
                */}
                <AnimatePresence key={currentFolderId ?? "root"}>
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
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
          {!hasItems && (
            <DriveEmptyState isRoot={isRoot} isFiltering={isFiltering} />
          )}

          {/*
            The bottom of the listing, and the same element for both views —
            which is the reason it sits here rather than inside `DriveGrid` and
            the table. The grid and the table show the same listing in two
            shapes, and a sentinel per shape is two places for the trigger
            distance to drift apart.

            Outside the `<Table>` for the table's sake: a `<div>` is not
            something a table may contain, and dropped into `TableBody` the
            browser hoists it out of the table entirely — leaving the observer
            watching an element that is no longer where the rows end.
          */}
          {hasItems && (
            <InfiniteScrollSentinel
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              label="Loading more files"
            />
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
