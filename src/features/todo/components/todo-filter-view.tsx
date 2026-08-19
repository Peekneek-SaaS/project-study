"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import MainSelectFilter from "@/features/main/components/main-select-filters";
import { todoFilterParsers } from "@/features/todo/lib/params";
import { TODO_PRIORITIES } from "@/features/todo/lib/todo-priority";
import { MODIFIED_FILTERS } from "@/lib/list-filters";
import { cn } from "@/lib/utils";

/**
 * The todo page's toolbar.
 *
 * Writes to the URL and nothing else — `useTodosBrowser` reads the same params
 * back and asks the server for the narrowed list, so a filtered page is a link
 * somebody can send and the back button undoes it. The view lives in the same
 * params for the same reason, but its switch sits up by the title — see
 * `TodoViewType`.
 *
 * The filters are the two asked for, and adding a third is adding a parser to
 * `todoFilterParsers`, a `MainSelectFilter` here, and a `where` clause in the
 * router — deliberately three small edits in three obvious places rather than
 * one clever abstraction.
 */
const TodoFilterView = () => {
  // Every filter change is a new list to fetch, and the list suspends — with
  // this toolbar inside that boundary, an urgent update would replace the
  // dropdown that was just clicked with the loading skeleton. In a transition
  // React holds the old list up until the new one is ready. Same reasoning as
  // the notes wall's toolbar.
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(todoFilterParsers, {
    // A filter is a view of the same page, not a place of its own.
    history: "replace",
    startTransition,
  });

  const isFiltering = filters.priority !== null || filters.modified !== null;

  return (
    <div className="flex items-center gap-2 py-2">
      <MainSelectFilter
        placeholder="Priority"
        anyLabel="Any priority"
        value={filters.priority}
        onValueChange={(priority) => setFilters({ priority })}
        values={TODO_PRIORITIES}
      />

      <MainSelectFilter
        placeholder="Modified"
        anyLabel="Any time"
        value={filters.modified}
        onValueChange={(modified) => setFilters({ modified })}
        values={MODIFIED_FILTERS}
      />

      {isFiltering && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setFilters({ priority: null, modified: null })}
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

export default TodoFilterView;
