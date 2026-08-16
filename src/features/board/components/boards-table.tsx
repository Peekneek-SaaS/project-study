"use client";

import { useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BoardRow } from "@/features/board/components/board-row";
import { BoardsEmptyState } from "@/features/board/components/boards-empty-state";
import BoardsFilterView from "@/features/board/components/boards-filter-view";
import { DeleteBoardDialog } from "@/features/board/components/delete-board-dialog";
import { DeleteBoardsDialog } from "@/features/board/components/delete-boards-dialog";
import { RenameBoardDialog } from "@/features/board/components/rename-board-dialog";
import { useBoardsBrowser } from "@/features/board/hooks/use-boards-browser";
import { boardPath, type BoardListItem } from "@/features/board/types";
import { MotionTableBody } from "@/components/motion/motion-table";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { listContainer, mountAnimation } from "@/lib/motion";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useBoardSelectionStore } from "@/lib/stores/board-selection-store";
import { cn } from "@/lib/utils";

/**
 * What keeps a column heading under the toolbar as the rows scroll past it.
 *
 * The same rule, and the same two traps, as the drive's — see `STICKY_HEAD` in
 * `main-content.tsx`: `md:` throughout because below it the table keeps the
 * `overflow-x-auto` container it ships with, and a heading left sticky inside
 * that is displaced rather than ignored; and an inset shadow for the divider,
 * because a collapsed border belongs to the table rather than to the cell and
 * stays behind when the cell sticks.
 */
const STICKY_HEAD =
  "md:sticky md:top-[calc(var(--drive-sticky-top)+var(--drive-title-h)+var(--drive-toolbar-h))] md:z-10 md:bg-background md:shadow-[inset_0_-1px_0_0_var(--border)]";

/**
 * Every board you own, newest edit first.
 *
 * Built to behave like the drive's listing rather than merely to look like it:
 * the same click-to-select and double-click-to-open, the same modifier and
 * touch-hold gestures, the same keyboard, and the same toolbar that cross-fades
 * into a selection bar. What it does not have is drag and drop — there is
 * nowhere to drag a board *to* until boards can live in folders.
 */
export function BoardsTable() {
  const router = useRouter();
  const { boards, isFiltering } = useBoardsBrowser();

  const selectedIds = useBoardSelectionStore((state) => state.ids);
  const clearSelection = useBoardSelectionStore((state) => state.clear);

  // The dialogs live here rather than in each row: a row unmounts the moment
  // the list refetches after a rename, and it would take its dialog with it.
  const [renaming, setRenaming] = useState<BoardListItem | null>(null);
  const [deleting, setDeleting] = useState<BoardListItem | null>(null);
  const [deletingMany, setDeletingMany] = useState<string[] | null>(null);

  // Click to select, double-click to open; ⌘/ctrl, shift and the arrow keys do
  // the rest, and the hook binds those keys for as long as the table is up.
  const rows = useMemo(
    () =>
      boards.map((board) => ({
        id: board.id,
        open: () => router.push(boardPath(board.id)),
      })),
    [boards, router],
  );
  const { selectRow, selectAll } = useRowSelection(rows, useBoardSelectionStore);

  // What is on screen decides. Rows can go out from under a selection — deleted
  // from their own menu, filtered away — and reading the ticks back off the
  // list keeps a stale id out of the count and off the request.
  const selected = boards
    .filter((board) => selectedIds.has(board.id))
    .map((board) => board.id);

  const isSelecting = selected.length > 0;
  const allSelected = boards.length > 0 && selected.length === boards.length;

  // The selection bar stays mounted through its own fade-out, so it needs
  // something to say on the way out — reading the live count there would flash
  // "0 boards selected" across the fade. So it holds the last count it was
  // shown with, updated during the render that changes it rather than in an
  // effect, which would paint the old number for a frame first.
  const [shownCount, setShownCount] = useState(selected.length);
  if (isSelecting && shownCount !== selected.length)
    setShownCount(selected.length);

  return (
    <>
      {/*
        Both bars share one grid cell and cross-fade in place, and the whole
        thing sticks under the title bar — the drive's arrangement, and the
        reasoning behind every part of it is written out in `main-content.tsx`.
      */}
      <div className="sticky top-[calc(var(--drive-sticky-top)+var(--drive-title-h))] z-20 -mx-4 grid h-(--drive-toolbar-h) grid-cols-1 grid-rows-1 bg-background px-4 *:col-start-1 *:row-start-1">
        <div
          inert={isSelecting}
          className={cn(
            "transition-[opacity,visibility] duration-150 ease-out",
            isSelecting && "invisible opacity-0",
          )}
        >
          <BoardsFilterView />
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
              {shownCount} {shownCount === 1 ? "board" : "boards"} selected
            </span>
            {/* Hidden rather than dropped once everything is picked, so the row
              either side of it stays put. */}
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
            onClick={() => setDeletingMany(selected)}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <div
        // Hands the sticky headings back to the page — see the drive's listing
        // wrapper, and keep this at the same breakpoint as `STICKY_HEAD`.
        // `flex flex-1 flex-col` carries the view's leftover height down to the
        // empty state, which centres itself in it.
        className="flex flex-1 flex-col md:[&_[data-slot=table-container]]:overflow-x-visible"
        // Clicking past the list drops the selection, the way clicking empty
        // space in a file manager does. Rows answer their own clicks; buttons
        // and menus speak for themselves. Anything else here is background.
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(`[${ROW_ATTRIBUTE}], button, a, [role='menuitem']`))
            return;
          clearSelection();
        }}
      >
        {boards.length === 0 ? (
          <BoardsEmptyState isFiltering={isFiltering} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={STICKY_HEAD}>Name</TableHead>
                <TableHead className={cn(STICKY_HEAD, "hidden sm:table-cell")}>
                  Created
                </TableHead>
                <TableHead className={STICKY_HEAD}>Last edited</TableHead>
                <TableHead className={cn(STICKY_HEAD, "w-12 text-right")}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            {/* The stagger lives on the body — see `main-content.tsx`. */}
            <MotionTableBody {...mountAnimation} variants={listContainer}>
              {boards.map((board) => (
                <BoardRow
                  key={board.id}
                  board={board}
                  onSelect={selectRow}
                  onRename={setRenaming}
                  onDelete={setDeleting}
                />
              ))}
            </MotionTableBody>
          </Table>
        )}
      </div>

      <RenameBoardDialog board={renaming} onClose={() => setRenaming(null)} />
      <DeleteBoardDialog board={deleting} onClose={() => setDeleting(null)} />
      <DeleteBoardsDialog
        ids={deletingMany}
        onClose={() => setDeletingMany(null)}
      />
    </>
  );
}
