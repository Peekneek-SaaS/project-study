"use client";

import { useTransition } from "react";
import { SearchXIcon, SquareMousePointer } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BoardCreateButton } from "@/features/board/components/board-create-button";
import { boardFilterParsers } from "@/features/board/lib/params";

/** Nothing to show, and which of the two reasons that is. */
export function BoardsEmptyState({ isFiltering }: { isFiltering: boolean }) {
  // In a transition for the same reason the toolbar's setter is: clearing the
  // filter refetches the list, and this button sits inside the boundary that
  // would otherwise blank out under it. See `boards-filter-view`.
  const [, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(boardFilterParsers, {
    history: "replace",
    startTransition,
  });

  // A filtered-away list is not an empty account, and offering to make a board
  // there answers a question nobody asked — the way out is the filter.
  if (isFiltering) {
    return (
      <Empty className="">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No boards match this filter</EmptyTitle>
          <EmptyDescription>
            Nothing was edited in that window. Try a wider one, or clear it to
            see every board.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            onClick={() => setFilters({ modified: null })}
          >
            Clear filter
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SquareMousePointer className="text-purple-500" />
        </EmptyMedia>
        <EmptyTitle>No boards yet</EmptyTitle>
        <EmptyDescription>
          Boards are freeform canvases — sketch, diagram, think out loud.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <BoardCreateButton label="Create your first board" />
      </EmptyContent>
    </Empty>
  );
}
