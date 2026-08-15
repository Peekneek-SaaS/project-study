"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import MainSelectFilter from "@/features/main/components/main-select-filters";
import { DRIVE_TYPE_FILTERS } from "@/features/main/lib/drive-filters";
import { MODIFIED_FILTERS } from "@/lib/list-filters";
import { driveFilterParsers } from "@/features/main/lib/params";
import { cn } from "@/lib/utils";

/**
 * The drive's filter toolbar.
 *
 * Writes to the URL and nothing else — `useDriveBrowser` reads the same params
 * back and asks the server for the narrowed listing, so a filtered view is a
 * link somebody can send, and the back button undoes a filter.
 */
const MainFilterView = () => {
  // Every filter change is a new listing to fetch, and the listing suspends —
  // with the toolbar inside that same boundary, an urgent update would replace
  // the dropdown that was just clicked with the loading skeleton. In a
  // transition React holds the old listing up until the new one is ready, so
  // the only thing that changes is this spinner.
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(driveFilterParsers, {
    // A filter is a view of the same page, not a place of its own — pushing
    // each one would make Back mean "undo one dropdown", several times over.
    history: "replace",
    startTransition,
  });

  const isFiltering = filters.type !== null || filters.modified !== null;

  return (
    <div className="flex items-center gap-2 py-2">
      <MainSelectFilter
        placeholder="Type"
        anyLabel="Any type"
        value={filters.type}
        onValueChange={(type) => setFilters({ type })}
        values={DRIVE_TYPE_FILTERS}
      />
      <MainSelectFilter
        placeholder="Modified"
        anyLabel="Any time"
        value={filters.modified}
        onValueChange={(modified) => setFilters({ modified })}
        values={MODIFIED_FILTERS}
      />

      {/* One reach for "show me everything again", rather than two dropdowns. */}
      {isFiltering && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setFilters({ type: null, modified: null })}
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

export default MainFilterView;
