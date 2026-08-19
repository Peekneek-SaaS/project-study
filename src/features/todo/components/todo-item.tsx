"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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
import { workPath } from "@/features/work/types";
import { listItem } from "@/lib/motion";
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
  documentId,
  isPast = false,
}: {
  todo: Todo;
  now: number | null;
  variant?: "row" | "card";
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

  if (isEditing) {
    return (
      <TodoEditor
        todo={todo}
        onClose={() => setIsEditing(false)}
        documentId={documentId}
      />
    );
  }

  const isRunning = timer.state === "running";
  const isCard = variant === "card";

  // A day that has gone by with this still unticked: not done, and no longer
  // doable on the day it was meant for.
  const isMissed = isPast && !todo.completed;

  return (
    <motion.div
      variants={listItem}
      layout="position"
      className={cn(
        "group/todo flex items-center gap-3",
        isCard
          ? "rounded-xl border bg-card px-3 py-2.5 shadow-xs transition-shadow hover:shadow-sm"
          : "border-b px-1 py-2.5 last:border-b-0",
      )}
    >
      <TodoCheckbox
        completed={todo.completed}
        priority={todo.priority}
        // The ring is only a countdown while it is counting. A paused timer
        // showing a half-filled ring would be indistinguishable from a running
        // one at a glance.
        progress={isRunning ? timer.progress : null}
        onToggle={() => void setCompleted(todo.id, !todo.completed)}
      />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          title="Edit task"
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm transition-colors hover:text-primary",
            /*
              Both kinds of "not on the list any more" are struck through
              rather than faded.

              Fading the whole row took the title, the flag, the timer and the
              menu down with it — a row you could still click but could barely
              read, and on a day full of finished tasks the page went grey. A
              line through the words says the one thing that is actually true
              about the task, leaves everything around it at full contrast, and
              keeps the two states apart by colour: done is quiet, missed is
              the day heading's own red.
            */
            todo.completed &&
              "text-muted-foreground line-through decoration-muted-foreground",
            isMissed && "line-through decoration-destructive/70",
          )}
        >
          {todo.title}
        </button>

        {/*
          Where the task came from, when it came from somewhere.

          A link rather than a label, because "read chapter 4" is a task you
          want to be one click from the thing you have to read. Only on the todo
          page — inside the document's own tab this would be the same words on
          every row — and only the name, since the icon already says what kind
          of thing it is.
        */}
        {todo.document && !documentId && (
          <Link
            href={workPath(todo.document.id)}
            title={`Open ${todo.document.name}`}
            className="flex min-w-0 max-w-40 shrink items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileText className="size-3 shrink-0 fill-orange-400 stroke-orange-200" />
            <span className="truncate">{todo.document.name}</span>
          </Link>
        )}

        {/* Only worth a mark when it is actually saying something. */}
        {todo.priority !== "NONE" && !todo.completed && (
          <Flag
            className={cn("size-3.5 shrink-0", meta.className)}
            aria-label={`${meta.label} priority`}
          />
        )}
      </div>

      {todo.timerSeconds !== null && !todo.completed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void setTimerRunning(todo.id, isRunning ? "pause" : "start")}
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
      )}

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
    </motion.div>
  );
}
