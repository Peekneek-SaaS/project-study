"use client";

import { TodoDaySection } from "@/features/todo/components/todo-day-section";
import { TodoEmptyState } from "@/features/todo/components/todo-empty-state";
import TodoFilterView from "@/features/todo/components/todo-filter-view";
import { useTodoClock } from "@/features/todo/hooks/use-todo-clock";
import { useTodoDayNavigation } from "@/features/todo/hooks/use-todo-day-navigation";
import { useTodosBrowser } from "@/features/todo/hooks/use-todos-browser";
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
  const { groups, today, view, isFiltering, hasRunningTimer } =
    useTodosBrowser(serverView);

  const now = useTodoClock(hasRunningTimer);
  const flashingDay = useTodoDayNavigation(view);

  // Only a filter can empty this page — see `TodoEmptyState`.
  const isEmpty = groups.every((group) => group.todos.length === 0);
  const showEmptyState = isFiltering && isEmpty;

  const isGrid = view === "grid";

  return (
    <>
      {/* Parked under the title bar, which is itself parked under the header.
          The offsets those read are declared by the view — the drive's
          arrangement, spelled out in `main-content.tsx`. */}
      <div className="sticky top-[calc(var(--drive-sticky-top)+var(--drive-title-h))] z-20 -mx-4 h-(--drive-toolbar-h) bg-background px-4">
        <TodoFilterView />
      </div>

      {/* `min-h-0` so the grid below can be given a height and have it mean
          something: a flex item that refuses to shrink past its content cannot
          be the thing that scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col pt-2">
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
                    "-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 [&>section]:scroll-ml-4",
                    /*
                      And it is given the height that is left over rather than
                      being allowed to size itself.

                      This is what was breaking the grid. Left to its content, a
                      sideways scroller grows to the tallest column, every other
                      column stretches to match, and the whole page ends up as
                      tall as the busiest day with its horizontal scrollbar
                      pushed somewhere off the bottom of the window — so moving
                      between days meant scrolling down to find the bar and back
                      up to read a column.

                      Bounded to the viewport minus everything sticky above it —
                      the header, the title bar, the toolbar — plus the page's
                      own padding, each of which is already declared as a
                      variable by the view. Now the columns fill the screen
                      exactly, each scrolls its own tasks, and the page itself
                      does not scroll at all: a board, which is what a grid of
                      days was meant to be.
                    */
                    "h-[calc(100svh-var(--drive-sticky-top)-var(--drive-title-h)-var(--drive-toolbar-h)-2.5rem)]",
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
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
