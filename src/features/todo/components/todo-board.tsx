"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TodoDaySection } from "@/features/todo/components/todo-day-section";
import { TodoEmptyState } from "@/features/todo/components/todo-empty-state";
import TodoFilterView from "@/features/todo/components/todo-filter-view";
import { useTodoClock } from "@/features/todo/hooks/use-todo-clock";
import { useTodoDayNavigation } from "@/features/todo/hooks/use-todo-day-navigation";
import { useTodosBrowser } from "@/features/todo/hooks/use-todos-browser";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useModalStore } from "@/lib/stores/modal-store";
import { useTodoSelectionStore } from "@/lib/stores/todo-selection-store";
import type { TodoViewType } from "@/lib/stores/todo-view-store";
import { cn } from "@/lib/utils";

/**
 * The days, in whichever direction the view is remembered in.
 *
 * Both views draw the same groups in the same order — future first — and differ
 * only in the axis they run along: the list goes down the page, the grid goes
 * across it. That is why the day sections take a `variant` rather than there
 * being two of them, and why the scroll that lands on today works the same way
 * in both, just on the other axis.
 *
 * One clock for the whole page, started only when something is actually
 * counting and handed down to every row. A timer per row would be twenty
 * intervals waking up at slightly different moments, and the countdowns would
 * visibly disagree by a fraction of a second.
 */
export function TodoBoard({ serverView }: { serverView: TodoViewType }) {
  const { todos, groups, today, view, isFiltering, hasRunningTimer } =
    useTodosBrowser(serverView);

  const now = useTodoClock(hasRunningTimer);
  const flashingDay = useTodoDayNavigation(view);

  const openModal = useModalStore((state) => state.open);

  const selectedIds = useTodoSelectionStore((state) => state.ids);
  const clearSelection = useTodoSelectionStore((state) => state.clear);

  // The page's order, flattened out of the days. Both things `useRowSelection`
  // answers are questions about order — which rows lie between the anchor and
  // the one clicked, which row is below this one — and a day on its own cannot
  // answer either, which is why this lives here rather than in a section.
  const rows = useMemo(
    () =>
      groups.flatMap((group) =>
        group.todos.map((todo) => ({
          id: todo.id,
          // Opening a task is opening its editor, which belongs to the row.
          // Enter therefore has nothing to call from up here — the row's own
          // handler covers it — so this is deliberately empty rather than
          // duplicating the editor's state on the page.
          open: () => {},
        })),
      ),
    [groups],
  );

  const { selectRow, selectAll } = useRowSelection(rows, useTodoSelectionStore);

  // A selection describes what is on screen, so it does not outlive the page.
  // Ticks left behind would be waiting on the next visit, pointing at tasks the
  // reader had long since stopped thinking about.
  //
  // Only on the way out. A filter narrowing the list mid-selection needs no
  // cleanup, because what the bar counts and what Delete is given are both read
  // back off the visible tasks below — a ticked row that has been filtered away
  // is simply not in either.
  useEffect(() => clearSelection, [clearSelection]);

  // Read back off what is on screen, as the drive and the wall do: a task can
  // leave the list while still ticked — deleted from its own menu, or filtered
  // away — and a stale id would otherwise ride into the count and the request.
  const selected = todos
    .filter((todo) => selectedIds.has(todo.id))
    .map((todo) => todo.id);

  const isSelecting = selected.length > 0;
  const allSelected = todos.length > 0 && selected.length === todos.length;

  // The bar stays mounted through its own fade, so it needs something to say on
  // the way out — reading the live count there would flash "0 selected" across
  // the fade. Updated during the render that changes it rather than in an
  // effect, which would paint the old number for a frame first.
  const [shownCount, setShownCount] = useState(selected.length);
  if (isSelecting && shownCount !== selected.length) {
    setShownCount(selected.length);
  }

  // Only a filter can empty this page — see `TodoEmptyState`.
  const isEmpty = groups.every((group) => group.todos.length === 0);
  const showEmptyState = isFiltering && isEmpty;

  const isGrid = view === "grid";

  return (
    <>
      {/*
        Parked under the title bar, which is itself parked under the header. The
        offsets those read are declared by the view — the drive's arrangement,
        spelled out in `main-content.tsx`.

        The filters and the selection bar share the one grid cell, stacked, so
        the days underneath never step up or down as a selection starts and
        ends. They cross-fade in place rather than swapping: mounting one
        subtree and unmounting the other let this bar collapse to nothing for a
        frame in between, which read as a flick. `inert` takes the hidden one
        out of the tab order and off the pointer the moment it starts to leave,
        so only the live bar can be reached however long the fade runs. The same
        arrangement, for the same reasons, as the drive's.
      */}
      <div className="sticky top-[calc(var(--drive-sticky-top)+var(--drive-title-h))] z-20 -mx-4 grid h-(--drive-toolbar-h) grid-cols-1 grid-rows-1 bg-background px-4 *:col-start-1 *:row-start-1">
        <div
          inert={isSelecting}
          className={cn(
            "transition-[opacity,visibility] duration-250 ease-out",
            isSelecting && "invisible opacity-0",
          )}
        >
          <TodoFilterView />
        </div>

        <div
          inert={!isSelecting}
          className={cn(
            "flex w-full items-center justify-between gap-3 py-2",
            "transition-[opacity,visibility] duration-250 ease-out",
            !isSelecting && "invisible opacity-0",
          )}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              aria-label="Clear the selection"
            >
              <X />
            </Button>
            {/* `tabular-nums` so counting up does not shuffle everything to the
                right of the number by a fraction of a character. */}
            <span className="text-sm tabular-nums">
              {shownCount} {shownCount === 1 ? "todo" : "todos"} selected
            </span>
            {/* Hidden rather than dropped once everything is picked, so the
                Delete beside it does not slide sideways as the last task joins
                the selection. ⌘A does the same thing from the keyboard. */}
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

          {/*
            The one delete on this page that asks first.

            A task's own menu still deletes on the spot, and so does a day's
            "Delete all", because each of those is aimed at something the reader
            is looking at as they click it. This one is not: it is pointed at a
            selection that can span the whole fortnight, gathered by ticks made
            minutes and a scroll apart, and the tasks it takes are mostly off
            screen. The ids are handed over rather than read from the store by
            the dialog, because what is ticked and what is *here* are two
            different lists — see `selected` above.
          */}
          <Button
            variant="destructive"
            size="sm"
            aria-label="Delete the selected tasks"
            onClick={() => openModal("delete-todos", { ids: selected })}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      {/*
        `min-h-0` so the grid below can be given a height and have it mean
        something, and `min-w-0` for the same reason on the other axis — which
        is the one that was breaking.

        A flex item's automatic minimum size is its *content's* size, so every
        wrapper between the page and a sideways scroller has to be told it may
        be narrower than what is inside it. Without that the fortnight of
        columns sets the width of this column, then of the page, then of the
        whole inset — the scroller never has less room than its content, so it
        never scrolls, and the page grows sideways under the sidebar and header
        instead. The chain has to be unbroken: one wrapper without it is enough
        to push the width back out.
      */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          // In the grid this gap belongs to the scroller instead — see the
          // `pt-2` on it — so the flash ring has room inside the clip.
          !isGrid && "pt-2",
        )}
        // Clicking past the tasks drops the selection, the way clicking empty
        // space in a file manager does. Rows carry a row key and answer their
        // own clicks; buttons, links and menu entries speak for themselves.
        // Anything else here is background.
        //
        // Wrapped around the days alone rather than the whole view, because the
        // selection bar sits above it — a "Select all" that cleared the
        // selection on the way back up would be worse than none.
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (
            target.closest(`[${ROW_ATTRIBUTE}], button, a, [role='menuitem']`)
          )
            return;
          clearSelection();
        }}
      >
        {showEmptyState ? (
          <TodoEmptyState />
        ) : (
          <div
            className={cn(
              isGrid
                ? cn(
                    // A fortnight of columns is wider than any screen, so the
                    // grid scrolls sideways and snaps to a column edge rather
                    // than squeezing every day into an unreadable sliver.
                    //
                    // `min-w-0` on the scroller itself as well as on its
                    // wrappers, and `overscroll-x-contain` so running out of
                    // days does not hand the swipe to the page behind it and
                    // trigger a back-navigation. The same set the attachment
                    // strip uses, which is the one horizontal snap scroller in
                    // here that was already behaving.
                    //
                    // `pt-2` as well as `pb-4`, because this clips on both axes:
                    // declaring `overflow-x` leaves `overflow-y` computed as
                    // `auto`, not `visible`. A column is `h-full`, so with no
                    // room above it the flash ring the calendar leaves on the
                    // day it sent you to was cut off flush along this edge, and
                    // the day arrived missing its top line.
                    "-mx-4 flex min-w-0 snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain px-4 pt-2 pb-4 [&>section]:scroll-ml-4",
                    /*
                      And it is given the height that is left over rather than
                      being allowed to size itself.

                      Left to its content, a sideways scroller grows to the
                      tallest column, every other column stretches to match, and
                      the board ends up as tall as the busiest day with its
                      horizontal scrollbar pushed off the bottom of the window —
                      so moving between days meant scrolling down to find the
                      bar and back up to read a column.

                      `h-full` rather than a calculation, now that the page has a
                      real height to take a share of: the wrapper around this is
                      what remains of it once the title bar and the toolbar have
                      had theirs, so this is exactly the space available and
                      there is no measurement to keep in step. The columns fill
                      the screen, each scrolls its own tasks, and the board never
                      scrolls vertically — which is what a grid of days was meant
                      to be.
                    */
                    "h-full",
                  )
                : "flex flex-col gap-8",
            )}
          >
            {groups.map((group) => (
              <TodoDaySection
                key={group.key}
                group={group}
                today={today}
                now={now}
                variant={isGrid ? "grid" : "list"}
                isFlashing={group.key === flashingDay}
                onSelect={selectRow}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
