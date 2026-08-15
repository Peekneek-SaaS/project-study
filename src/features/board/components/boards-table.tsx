"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MoreVertical, Pen, SquareMousePointer, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BoardCreateButton } from "@/features/board/components/board-create-button";
import { DeleteBoardDialog } from "@/features/board/components/delete-board-dialog";
import { RenameBoardDialog } from "@/features/board/components/rename-board-dialog";
import { boardPath, type BoardListItem } from "@/features/board/types";
import { formatDriveDate } from "@/features/main/lib/format-drive-date";
import { useTRPC } from "@/trpc/client";

/**
 * Every board you own, newest edit first.
 *
 * Rows are links rather than click handlers: a board is a page, so it should
 * open in a new tab, be copyable, and be reachable by keyboard the way any
 * other link is. The menu is fenced off from that link — see the `<td>`.
 */
export function BoardsTable() {
  const trpc = useTRPC();
  const { data: boards } = useSuspenseQuery(trpc.board.list.queryOptions());

  // The dialogs live here rather than in each row: a row unmounts the moment
  // the list refetches after a rename, and it would take its dialog with it.
  const [renaming, setRenaming] = useState<BoardListItem | null>(null);
  const [deleting, setDeleting] = useState<BoardListItem | null>(null);

  if (boards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <SquareMousePointer className="size-8 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No boards yet</p>
          <p className="text-sm text-muted-foreground">
            Boards are freeform canvases — sketch, diagram, think out loud.
          </p>
        </div>
        <BoardCreateButton label="Create your first board" />
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead>Last edited</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boards.map((board) => (
            <TableRow key={board.id}>
              <TableCell>
                <Link
                  href={boardPath(board.id)}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <SquareMousePointer className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{board.name}</span>
                </Link>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {formatDriveDate(board.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDriveDate(board.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
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
                    <DropdownMenuItem onSelect={() => setRenaming(board)}>
                      <Pen />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleting(board)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <RenameBoardDialog board={renaming} onClose={() => setRenaming(null)} />
      <DeleteBoardDialog board={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
