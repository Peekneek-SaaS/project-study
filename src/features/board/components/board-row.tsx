"use client";

import { MoreVertical, Pen, SquareArrowOutUpRight, SquareMousePointer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { boardPath, type BoardListItem } from "@/features/board/types";
import { DriveRowActions } from "@/features/main/components/drive-row-actions";
import { SELECTED_ROW_CLASS } from "@/features/main/lib/drive-row-classes";
import { formatDriveDate } from "@/features/main/lib/format-drive-date";
import {
  type RowSelectModifiers,
  useRowInteraction,
} from "@/hooks/use-row-interaction";
import {
  selectHasSelection,
  selectIsRowSelected,
} from "@/lib/stores/create-selection-store";
import { useBoardSelectionStore } from "@/lib/stores/board-selection-store";
import { cn } from "@/lib/utils";

/**
 * One board in the table.
 *
 * Click selects and double-click opens, as in the drive — which cost the row
 * the `<Link>` it used to be, since a link that navigates on the first click
 * cannot also be the first click of a selection. "Open in new tab" moves into
 * the menu, where it is still a real anchor and still ⌘-clickable.
 */
export function BoardRow({
  board,
  onSelect,
  onRename,
  onDelete,
}: {
  board: BoardListItem;
  onSelect: (modifiers: RowSelectModifiers, id: string) => void;
  onRename: (board: BoardListItem) => void;
  onDelete: (board: BoardListItem) => void;
}) {
  const router = useRouter();

  const isSelected = useBoardSelectionStore(selectIsRowSelected(board.id));
  const hasSelection = useBoardSelectionStore(selectHasSelection);
  const toggle = useBoardSelectionStore((state) => state.toggle);

  const rowProps = useRowInteraction({
    rowKey: board.id,
    hasSelection,
    onToggle: () => toggle(board.id),
    onOpen: () => router.push(boardPath(board.id)),
    onSelect: (modifiers) => onSelect(modifiers, board.id),
  });

  return (
    <TableRow
      {...rowProps}
      aria-selected={isSelected}
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        // `select-none` so double-clicking to open does not leave the name
        // highlighted underneath the board.
        "cursor-default select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-input/50",
        SELECTED_ROW_CLASS,
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2 font-medium">
          <SquareMousePointer className="size-4 shrink-0 text-purple-500" />
          <span className="truncate">{board.name}</span>
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {formatDriveDate(board.createdAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDriveDate(board.updatedAt)}
      </TableCell>
      <DriveRowActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${board.name}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            {/* A real anchor, so this is the one place the board can still be
              opened in a new tab or copied as a link. */}
            <DropdownMenuItem asChild>
              <Link href={boardPath(board.id)}>
                <SquareArrowOutUpRight />
                Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(board)}>
              <Pen />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(board)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DriveRowActions>
    </TableRow>
  );
}
