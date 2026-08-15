"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { boardFilterParsers } from "@/features/board/lib/params";
import MainSelectFilter from "@/features/main/components/main-select-filters";
import { MODIFIED_FILTERS } from "@/lib/list-filters";
import { cn } from "@/lib/utils";

/**
 * The boards table's filter toolbar.
 *
 * Writes to the URL and nothing else — `useBoardsBrowser` reads the same param
 * back and asks the server for the narrowed list, so a filtered view is a link
 * somebody can send, and the back button undoes it.
 */
const BoardsFilterView = () => {
  // Every filter change is a new list to fetch, and the list suspends — with
  // this toolbar inside that same boundary, an urgent update would replace the
  // dropdown that was just clicked with the loading skeleton. In a transition
  // React holds the old list up until the new one is ready, so the only thing
  // that changes is this spinner.
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(boardFilterParsers, {
    // A filter is a view of the same page, not a place of its own — pushing
    // each one would make Back mean "undo one dropdown".
    history: "replace",
    startTransition,
  });

  return (
    <div className="flex items-center gap-2 py-2">
      <MainSelectFilter
        placeholder="Modified"
        anyLabel="Any time"
        value={filters.modified}
        onValueChange={(modified) => setFilters({ modified })}
        values={MODIFIED_FILTERS}
      />

      {filters.modified !== null && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setFilters({ modified: null })}
        >
          <X />
          Clear
        </Button>
      )}

      {/* Kept out of the flow's way: it appears and goes without the row
          shuffling around it. */}
      <Spinner
        className={cn(
          "size-4 text-muted-foreground transition-opacity",
          !isPending && "opacity-0",
        )}
      />
    </div>
  );
};

export default BoardsFilterView;
