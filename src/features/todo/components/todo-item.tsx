"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import {
  FileText,
  Flag,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TodoCheckbox } from "@/features/todo/components/todo-checkbox";
import { TodoEditor } from "@/features/todo/components/todo-editor";
import { useTodoMutations } from "@/features/todo/hooks/use-todo-mutations";
import { priorityMeta } from "@/features/todo/lib/todo-priority";
import { formatCountdown, readTimer } from "@/features/todo/lib/todo-timer";
import type { Todo } from "@/features/todo/types";
import {
  useRowInteraction,
  type RowSelectModifiers,
} from "@/hooks/use-row-interaction";
import {
  selectHasSelection,
  selectIsRowSelected,
} from "@/lib/stores/create-selection-store";
import { useTodoSelectionStore } from "@/lib/stores/todo-selection-store";
import { workPath } from "@/features/work/types";
import { listItemMotion, presenceAnimation, revealPanel } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One task.
 *
 * The same component in both views — a row in the list and a card in the grid —
 * because it is the same task, and the only honest difference between the two
 * is how much room it has. `variant` picks the chrome and nothing else.
 *
 * This is also where a timer actually finishes. The countdown is derived from
 * the row and the clock, so every reader of the same todo agrees on it without
 * anything being broadcast; when it reaches zero, this ticks the task off. The
 * server does the same thing on every read of the list — see `sweepElapsedTimers`
 * — so the promise holds whether or not this tab was open to see it. Here it is
 * about being *punctual*: a row that waited for the next refetch would sit at
 * 0:00 looking stuck.
 */
export function TodoItem({
  todo,
  /** The shared clock. `null` before it starts — see `useTodoClock`. */
  now,
  variant = "row",
  onSelect,
  documentId,
  isPast = false,
}: {
  todo: Todo;
  now: number | null;
  variant?: "row" | "card";
  /**
   * Selection, resolved against the page's order — see `useRowSelection`.
   *
   * Its presence is what puts this row into the file-manager gestures: click to
   * select, double-click to edit, tap to edit, hold to select. Absent — in a
   * document's Todo tab, which has no toolbar to put a selection bar in — the
   * row keeps the plainer arrangement it has always had, where the title itself
   * is the button that opens the editor.
   */
  onSelect?: (modifiers: RowSelectModifiers, id: string) => void;
  /**
   * Whether the day this task is filed under has already gone by.
   *
   * Passed down rather than worked out here, so every row on the page agrees
   * with the heading above it about which day is today — the same `today` the
   * sections and the window were built from. See `useTodayKey`.
   */
  isPast?: boolean;
  /**
   * The document whose tab this row is being drawn in, if it is in one.
   *
   * Two jobs. It scopes the writes to the list actually on screen — see
   * `useTodoMutations` — and it is what silences the chip below: inside a
   * document's own tab, saying which document every task belongs to is saying
   * the same thing on every row.
   */
  documentId?: string;
}) {
  const { setCompleted, setTimerRunning, removeTodo } = useTodoMutations({
    documentId,
  });
  const [isEditing, setIsEditing] = useState(false);

  const isSelectable = onSelect !== undefined;
  const isSelected = useTodoSelectionStore(selectIsRowSelected(todo.id));
  const hasSelection = useTodoSelectionStore(selectHasSelection);
  const toggle = useTodoSelectionStore((state) => state.toggle);

  /**
   * The row's own gestures — the drive's, unchanged.
   *
   * Click selects and double-click opens on a pointer; tap opens and hold
   * selects on a phone, and once a hold has started a selection every further
   * tap joins it. All of that lives in `useRowInteraction`, which is handed
   * callbacks rather than a store precisely so that a second list can take up
   * the gesture without the two drifting apart on it.
   *
   * "Open" is the editor. A task has nowhere else to go — no page, no modal —
   * so what a double-click reveals is the same block the menu's "Edit task"
   * opens.
   */
  const rowProps = useRowInteraction({
    rowKey: todo.id,
    hasSelection,
    onToggle: () => toggle(todo.id),
    onOpen: () => setIsEditing(true),
    onSelect: (modifiers) => onSelect?.(modifiers, todo.id),
  });

  /**
   * Controls inside the row answer for themselves.
   *
   * Ticking a task off, starting its timer or opening its menu are clicks on a
   * control that happens to sit in a row — not clicks on the task — so they are
   * stopped before the row sees them. `display: contents` because this wrapper
   * exists only to catch events: it takes part in no layout, so the row's flex
   * still lays out the control itself.
   */
  const stopRowGestures = {
    className: "contents",
    ...(isSelectable && {
      onClick: (event: React.MouseEvent) => event.stopPropagation(),
      onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
      onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    }),
  };

  const timer = readTimer(todo, now);
  const meta = priorityMeta(todo.priority);

  // Guards the auto-complete against firing twice. The optimistic write flips
  // `todo.completed` on the very next render, which is normally enough — but
  // the mutation is async, and a tick landing in between would send a second
  // one.
  const autoCompleting = useRef(false);

  useEffect(() => {
    if (todo.completed) {
      autoCompleting.current = false;
      return;
    }

    if (timer.state !== "elapsed" || autoCompleting.current) return;

    autoCompleting.current = true;
    void setCompleted(todo.id, true);
  }, [setCompleted, timer.state, todo.completed, todo.id]);

  const isRunning = timer.state === "running";
  const isCard = variant === "card";

  // A day that has gone by with this still unticked: not done, and no longer
  // doable on the day it was meant for.
  const isMissed = isPast && !todo.completed;

  /*
    The parts of a task, built once and arranged twice.

    A row has the width to say everything on one line. A card does not — the
    grid's column is 18rem, and a document name, a flag, a countdown and a menu
    laid out beside the title left the title a few pixels to truncate into,
    which is to say the task was the one thing the card did not show. So the
    card gives the name a line of its own and puts everything *about* it
    underneath, where they read as annotations rather than as competitors.

    Held as values rather than split into a second component, so the two
    arrangements cannot drift: the tick box, the title, the chip, the flag, the
    countdown and the menu are literally the same nodes in both.
  */
  const checkbox = (
    <span {...stopRowGestures}>
      <TodoCheckbox
        completed={todo.completed}
        priority={todo.priority}
        // The ring is only a countdown while it is counting. A paused timer
        // showing a half-filled ring would be indistinguishable from a running
        // one at a glance.
        progress={isRunning ? timer.progress : null}
        onToggle={() => void setCompleted(todo.id, !todo.completed)}
      />
    </span>
  );

  /*
    A button where the row has no gestures of its own, and plain text where it
    has: with a click meaning "select", a title that also opened the editor on
    click would give one press two answers.
  */
  const titleNode = createElement(
    isSelectable ? "span" : "button",
    {
      ...(isSelectable
        ? {}
        : {
            type: "button" as const,
            onClick: () => setIsEditing(true),
            title: "Edit task",
          }),
      className: cn(
        "min-w-0 flex-1 truncate text-left text-sm transition-colors",
        !isSelectable && "hover:text-primary",
        /*
          Both kinds of "not on the list any more" are struck through rather
          than faded.

          Fading the whole row took the title, the flag, the timer and the menu
          down with it — a row you could still click but could barely read, and
          on a day full of finished tasks the page went grey. A line through the
          words says the one thing that is actually true about the task, leaves
          everything around it at full contrast, and keeps the two states apart
          by colour: done is quiet, missed is the day heading's own red.
        */
        todo.completed &&
          "text-muted-foreground line-through decoration-muted-foreground",
        isMissed && "line-through decoration-destructive/70",
      ),
    },
    todo.title,
  );

  /*
    Where the task came from, when it came from somewhere.

    A link rather than a label, because "read chapter 4" is a task you want to
    be one click from the thing you have to read. Only on the todo page — inside
    the document's own tab this would be the same words on every row — and only
    the name, since the icon already says what kind of thing it is.
  */
  const documentChip = todo.document && !documentId && (
    <span {...stopRowGestures}>
      <Link
        href={workPath(todo.document.id)}
        title={`Open ${todo.document.name}`}
        className="flex min-w-0 max-w-40 shrink items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        <FileText className="size-3 shrink-0 fill-orange-400 stroke-orange-200" />
        <span className="truncate">{todo.document.name}</span>
      </Link>
    </span>
  );

  /* Only worth a mark when it is actually saying something. */
  const priorityFlag = todo.priority !== "NONE" && !todo.completed && (
    <Flag
      className={cn("size-3.5 shrink-0", meta.className)}
      aria-label={`${meta.label} priority`}
    />
  );

  const timerButton = todo.timerSeconds !== null && !todo.completed && (
    <span {...stopRowGestures}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          void setTimerRunning(todo.id, isRunning ? "pause" : "start")
        }
        aria-label={isRunning ? "Pause timer" : "Start timer"}
        className={cn(
          "h-7 shrink-0 gap-1.5 rounded-full px-2.5 text-xs tabular-nums",
          isRunning
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted-foreground",
        )}
      >
        {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
        {formatCountdown(timer.remaining)}
      </Button>
    </span>
  );

  const actionsMenu = (
    <span {...stopRowGestures}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Task actions"
            // Out of the way until wanted, but never for a keyboard: hiding it
            // on focus would make it unreachable without a mouse.
            className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/todo:opacity-100 focus-visible:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setIsEditing(true)}>
            <Flag />
            Edit task
          </DropdownMenuItem>

          {todo.timerSeconds !== null && (
            <DropdownMenuItem
              onSelect={() => void setTimerRunning(todo.id, "reset")}
            >
              <RotateCcw />
              Reset timer
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void removeTodo(todo.id)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );

  /** Whether the card's second line has anything to put on it. */
  const hasMeta = Boolean(documentChip || priorityFlag || timerButton);

  return (
    /*
      The row and its editor are the same task in two states, so they swap
      inside a presence rather than replacing each other outright — which is
      what this used to do, and what made opening an editor feel like the row
      had been deleted and something else pasted in its place.

      `wait`, and nothing that projects a box from one place to another: the row
      fades out where it stands and the editor fades in over the same spot. The
      arrangement this replaces popped the row out of the flow and let the
      editor animate its `layout`, which in the grid — where a card sits in a
      narrow scrolling column rather than across the page — meant the projection
      measured two different boxes and slid the swap in from the side. Nothing
      here has moved, so nothing should travel.

      `propagate`, and this is the part with teeth: a nested presence ignores
      its parent's exit unless told otherwise, and the day's list around this is
      one. Without it a deleted task would vanish on the spot while every list
      that holds a plainer row faded out properly.
    */
    <AnimatePresence mode="wait" propagate>
      {isEditing ? (
        <motion.div key="editor" variants={revealPanel} {...presenceAnimation}>
          <TodoEditor
            todo={todo}
            onClose={() => setIsEditing(false)}
            documentId={documentId}
          />
        </motion.div>
      ) : (
        <motion.div
          key="row"
          {...listItemMotion}
          {...(isSelectable ? rowProps : {})}
          // `data-selected` rather than `aria-selected`, for the reason the note
          // card gives: a plain `div` has no role that takes it, and saying it
          // properly would mean making every day a listbox.
          data-selected={isSelected || undefined}
          className={cn(
            "group/todo flex",
            // A card stacks its two lines; a row is the one line.
            isCard
              ? "flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5 shadow-xs transition-shadow hover:shadow-sm"
              : "items-center gap-3 border-b px-1 py-2.5 last:border-b-0",
            isSelectable &&
              "cursor-default rounded-lg select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            /*
          A tick box already lives on the left of this row, so a *picked* task
          cannot be marked with another one — the row itself lights up instead.

          `ring-inset`, and that is the whole of the fix: a ring is a
          box-shadow, drawn *outside* the border box, so every scroller between
          this row and the page clipped the edges that sat against them — the
          left and right on the list's own scroller, the top of the first card
          on the grid column's. Half an outline read as a broken one. Inside the
          box there is nothing left to clip it.

          Full strength rather than `/40` for the same reason: at one pixel
          against a tinted background, a 40% line is a suggestion.
        */
            isSelected && "bg-primary/10 ring-1 ring-primary ring-inset",
          )}
        >
          {isCard ? (
            <>
              {/* The task itself, and the one control that acts on the whole of
              it. Nothing else is allowed on this line. */}
              <div className="flex items-center gap-3">
                {checkbox}
                <div className="flex min-w-0 flex-1 items-center">
                  {titleNode}
                </div>
                {actionsMenu}
              </div>

              {/* What is true *about* the task, on a line of its own, indented
              under the title rather than under the tick box. Wrapping, because
              three of these in an 18rem column is one too many for one line —
              and a second line of annotations costs less than a countdown
              nobody can read. */}
              {hasMeta && (
                <div className="flex flex-wrap items-center gap-2 pl-8">
                  {documentChip}
                  {/* {priorityFlag} */}
                  {timerButton}
                </div>
              )}
            </>
          ) : (
            <>
              {checkbox}

              <div className="flex min-w-0 flex-1 items-center gap-2">
                {titleNode}
                {documentChip}
                {/* {priorityFlag} */}
              </div>

              {timerButton}
              {actionsMenu}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
