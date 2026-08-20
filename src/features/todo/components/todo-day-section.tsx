"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, MoreHorizontal, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TodoComposer } from "@/features/todo/components/todo-composer";
import { TodoItem } from "@/features/todo/components/todo-item";
import { DAY_ATTRIBUTE } from "@/features/todo/hooks/use-todo-day-navigation";
import { useTodoMutations } from "@/features/todo/hooks/use-todo-mutations";
import type { TodoDayGroup } from "@/features/todo/lib/group-todos-by-day";
import { isPastDay, longDayLabel } from "@/features/todo/lib/todo-dates";
import type { RowSelectModifiers } from "@/hooks/use-row-interaction";
import { listContainer, mountAnimation } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One day, in either shape.
 *
 * The list draws days down the page and the grid draws them across it, but a
 * day is the same thing in both: a heading with a count, the tasks under it,
 * and a way to add one more. So it is one component with a `variant` rather
 * than two that would have to be kept in step every time a day learns to do
 * something new.
 *
 * Every day gets a section, including the empty ones. A "Tomorrow" that
 * vanished until it had something in it would give you nowhere to put the first
 * thing — the heading *is* the affordance, and the "Add task" under it is what
 * the day is for.
 */
export function TodoDaySection({
  group,
  today,
  now,
  variant,
  isFlashing = false,
  onSelect,
  documentId,
}: {
  group: TodoDayGroup;
  /** The page's one answer for what day it is — see `useTodayKey`. */
  today: string;
  /** The shared clock, handed down so every row counts off the same instant. */
  now: number | null;
  variant: "list" | "grid";
  isFlashing?: boolean;
  /**
   * Selection, passed straight through to the rows.
   *
   * The day cannot answer a shift-click on its own — a range runs across the
   * days above and below it — so this comes from the board, which is the only
   * thing that knows the page's order. See `useRowSelection`.
   */
  onSelect?: (modifiers: RowSelectModifiers, id: string) => void;
  /**
   * The document whose tab this section is being drawn in, if it is in one.
   *
   * Threaded down to the rows and the composer rather than read from the todos,
   * because it says which list is on screen — which is what the optimistic
   * writes have to land on, and what keeps "Delete all" on this day from
   * reaching past this document. See `useTodoMutations`.
   */
  documentId?: string;
}) {
  const { clearDay } = useTodoMutations({ documentId });

  const isGrid = variant === "grid";
  const isPast = isPastDay(group.key, today);

  /**
   * Days behind today start shut.
   *
   * The page reaches a week back so that what was missed is still reachable,
   * not so that it is the first thing read — and open, those days push today
   * further from where the page lands. A heading with a count says everything a
   * past day usually has to say; the chevron is there for when it does not.
   */
  const [isCollapsed, setIsCollapsed] = useState(isPast);
  const [isComposing, setIsComposing] = useState(false);

  // Being sent here is a reason to open: following the calendar to a day last
  // week and finding a closed heading would look like the link had missed.
  //
  // Adjusted during the render that changes it rather than in an effect, which
  // would paint the shut heading for a frame first — the same pattern the
  // selection bars use for their counts.
  const [wasFlashing, setWasFlashing] = useState(isFlashing);
  if (isFlashing !== wasFlashing) {
    setWasFlashing(isFlashing);
    if (isFlashing) setIsCollapsed(false);
  }

  const completedCount = group.todos.length - group.pendingCount;

  // A day in the past with work still on it is the one thing on this page worth
  // colouring red. Today is not overdue, and a finished past day is just past.
  const isOverdue = isPast && group.pendingCount > 0;

  return (
    <section
      {...{ [DAY_ATTRIBUTE]: group.key }}
      className={cn(
        "flex flex-col gap-2 scroll-mt-[calc(var(--drive-sticky-top)+var(--drive-title-h)+var(--drive-toolbar-h)+1rem)]",
        // In the grid the day is a column of a fixed width, so a fortnight of
        // them scrolls sideways instead of squeezing to nothing — and a full
        // height column, so it is the column's own tasks that scroll rather
        // than the board growing to the busiest day.
        isGrid && "h-full min-h-0 w-72 shrink-0 snap-start",
        // Ringed briefly after the header's calendar sent the reader here.
        isFlashing &&
          "rounded-lg ring-2 ring-primary/50 ring-offset-4 ring-offset-background",
        "transition-shadow duration-300",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-1.5",
          // The list's headings carry a rule under them; the grid's sit over
          // free-standing cards and would only be drawing boxes.
          !isGrid && "border-b pb-2",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`
          }
          className={cn(
            "size-6 shrink-0 text-muted-foreground",
            // The chevron is the state: down is open, right is shut.
            isCollapsed && "-rotate-90",
            "transition-transform duration-200",
          )}
        >
          <ChevronDown />
        </Button>

        <h2
          title={longDayLabel(group.key)}
          className={cn(
            "truncate text-sm font-semibold",
            // Today is the page's anchor — it is where the page opens and what
            // everything else is measured from — so it is the one heading that
            // is allowed to be loud.
            group.isToday && "text-primary",
            isOverdue && "line-through decoration-red-500 decoration-2",
          )}
        >
          {group.label}
        </h2>

        {/* Outstanding, not total: a day whose tasks are all done reads as
            clear, which is the thing worth knowing at a glance. */}
        <span className="text-xs tabular-nums text-muted-foreground">
          {group.pendingCount > 0 ? group.pendingCount : ""}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${group.label}`}
              className="ml-auto size-6 shrink-0 text-muted-foreground"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setIsCollapsed(false);
                setIsComposing(true);
              }}
            >
              <Plus />
              Add task
            </DropdownMenuItem>

            {(completedCount > 0 || group.todos.length > 0) && (
              <DropdownMenuSeparator />
            )}

            {completedCount > 0 && (
              <DropdownMenuItem onSelect={() => void clearDay(group.key, true)}>
                <Trash2 />
                Delete completed ({completedCount})
              </DropdownMenuItem>
            )}

            {group.todos.length > 0 && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void clearDay(group.key, false)}
              >
                <Trash2 />
                Delete all ({group.todos.length})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {!isCollapsed && (
        <div
          className={cn(
            "flex flex-col",
            isGrid
              ? // The column is what scrolls, not the board. `min-h-0` is what
                // lets it: without it this would refuse to shrink below its
                // tasks and push the height back out into the page.
                "min-h-0 flex-1 gap-2 overflow-y-auto pr-1"
              : "gap-0",
          )}
        >
          <motion.div
            {...mountAnimation}
            variants={listContainer}
            className={cn("flex flex-col", isGrid ? "gap-2" : "gap-0")}
          >
            {group.todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                now={now}
                variant={isGrid ? "card" : "row"}
                onSelect={onSelect}
                documentId={documentId}
                // The day already knows; the rows should not each ask the clock
                // again and risk disagreeing with the heading over them.
                isPast={isPast}
              />
            ))}
          </motion.div>

          {/* Said plainly, as asked. An empty day is a normal state — most days
              start out as one — so it gets a quiet line rather than an
              illustration and a call to action. */}
          {group.todos.length === 0 && !isComposing && (
            <p
              className={cn(
                "px-2 text-sm text-muted-foreground",
                isGrid ? "py-1" : "py-2",
              )}
            >
              No todos
            </p>
          )}

          {isComposing ? (
            <TodoComposer
              day={group.key}
              documentId={documentId}
              onClose={() => setIsComposing(false)}
              className={isGrid ? "" : "my-2"}
            />
          ) : (
            <Button
              variant="ghost"
              onClick={() => setIsComposing(true)}
              // Only as wide as what it says. Stretched across the day it read
              // as a row of its own — a task-shaped thing with no task in it.
              className="w-fit justify-start gap-2 px-2 font-normal text-muted-foreground hover:text-foreground"
            >
              <Plus />
              Add todo
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
