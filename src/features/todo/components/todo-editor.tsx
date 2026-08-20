"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TodoDateChip,
  TodoPriorityChip,
  TodoTimerChip,
} from "@/features/todo/components/todo-chips";
import { useTodoMutations } from "@/features/todo/hooks/use-todo-mutations";
import type { DayKey } from "@/features/todo/lib/todo-dates";
import type { TodoPriority } from "@/features/todo/lib/todo-priority";
import { MAX_TODO_TITLE } from "@/features/todo/lib/todo-title";
import type { Todo } from "@/features/todo/types";
import { cn } from "@/lib/utils";

/**
 * A todo, opened up for changing.
 *
 * The composer's shape, pointed at a row that already exists — same field, same
 * three chips, same order — because a task should be edited with the controls
 * it was created with. What differs is the ending: this one saves and closes,
 * where the composer clears and stays open for the next task.
 *
 * Everything is held locally until Save. A chip that wrote through on every
 * click would fire four round trips for one edit, and there would be no way to
 * back out of a half-made change.
 */
export function TodoEditor({
  todo,
  onClose,
  className,
  documentId,
}: {
  todo: Todo;
  onClose: () => void;
  className?: string;
  /**
   * Which list this editor is sitting in — a document's tab, or the todo page.
   *
   * The surface rather than the row: a task that belongs to a document is
   * editable from the page as well as from its tab, and the optimistic write
   * has to land on whichever list is actually on screen. Reading
   * `todo.documentId` here instead would paint the tab's cache while the page
   * is the thing being looked at.
   */
  documentId?: string;
}) {
  const { updateTodo } = useTodoMutations({ documentId });

  const [title, setTitle] = useState(todo.title);
  const [dueDate, setDueDate] = useState<DayKey>(todo.dueDate);
  const [priority, setPriority] = useState<TodoPriority>(todo.priority);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(
    todo.timerSeconds,
  );

  const trimmed = title.trim();
  const canSave = trimmed.length > 0;

  const save = async () => {
    if (!canSave) return;

    // Closed first. The write is optimistic, so the row behind this is already
    // showing the result — leaving the editor open until the request came back
    // would put a spinner over an answer that is already on screen.
    onClose();

    await updateTodo(todo.id, {
      title: trimmed,
      dueDate,
      priority,
      // Sent only when it actually changed: the router treats any mention of
      // `timerSeconds` as "restart this timer", so resending the same value
      // would rewind a countdown the user did not touch.
      ...(timerSeconds !== todo.timerSeconds && { timerSeconds }),
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-primary/40 bg-card p-2.5 shadow-xs",
        className,
      )}
    >
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={MAX_TODO_TITLE}
        aria-label="Task name"
        className="w-full bg-transparent px-1 text-sm outline-none"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <TodoDateChip value={dueDate} onChange={setDueDate} />
        <TodoTimerChip value={timerSeconds} onChange={setTimerSeconds} />
        <TodoPriorityChip value={priority} onChange={setPriority} />

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            aria-label="Cancel"
          >
            <X />
          </Button>
          <Button
            type="submit"
            size="icon"
            className="size-8"
            disabled={!canSave}
            aria-label="Save task"
          >
            <Check />
          </Button>
        </div>
      </div>
    </form>
  );
}
