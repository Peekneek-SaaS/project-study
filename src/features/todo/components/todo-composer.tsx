"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TodoDateChip,
  TodoPriorityChip,
  TodoTimerChip,
} from "@/features/todo/components/todo-chips";
import { useTodoMutations } from "@/features/todo/hooks/use-todo-mutations";
import type { DayKey } from "@/features/todo/lib/todo-dates";
import {
  DEFAULT_PRIORITY,
  type TodoPriority,
} from "@/features/todo/lib/todo-priority";
import { cn } from "@/lib/utils";

/**
 * The box that takes a new task.
 *
 * Three things in one field, in the order they are decided: what it is, when it
 * is, and how long it will take. The title is the only one that has to be
 * answered — the day arrives already set to the section the composer opened
 * under, and the timer stays empty unless it is wanted, because most tasks do
 * not want one.
 *
 * Submitting does not close it. Tasks arrive in handfuls rather than one at a
 * time, and a composer that shut after each one would have to be reopened, and
 * re-dated, for every item of a list somebody is in the middle of writing out.
 * The day, the timer and the priority stay put for the same reason; only the
 * title clears. Escape is the way out, and so is the ✕.
 */
export function TodoComposer({
  /** The day this composer was opened under. Where the task lands by default. */
  day,
  onClose,
  autoFocus = true,
  className,
  documentId,
}: {
  day: DayKey;
  onClose: () => void;
  autoFocus?: boolean;
  className?: string;
  /**
   * The document to file these tasks against, on a work page's Todo tab.
   *
   * Absent on the todo page, where a task stands on its own. Handed to the
   * mutations rather than to `createTodo` per call, because it is a property of
   * *where this composer is* and not of any one task typed into it.
   */
  documentId?: string;
}) {
  const { createTodo, isCreating } = useTodoMutations({ documentId });

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<DayKey>(day);
  const [priority, setPriority] = useState<TodoPriority>(DEFAULT_PRIORITY);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // The section a composer belongs to can change under it — the day headings
  // are recomputed from the clock, so an open composer survives midnight — and
  // when it does, an untouched date should follow rather than stay on
  // yesterday. Only when untouched: a date the user has picked is theirs.
  const openedOn = useRef(day);
  useEffect(() => {
    if (openedOn.current === day) return;
    setDueDate((current) => (current === openedOn.current ? day : current));
    openedOn.current = day;
  }, [day]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const canSubmit = title.trim().length > 0 && !isCreating;

  const submit = async () => {
    if (!canSubmit) return;

    // Cleared before the write rather than after it, so the next task can be
    // typed into an empty field immediately — the create is optimistic, so
    // there is nothing to wait for and nothing to undo if it fails.
    const pending = { title, dueDate, priority, timerSeconds };
    setTitle("");

    await createTodo(pending);
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        // Escape closes, unless a chip's popover is what is open — that one
        // gets to close itself first, and it stops the event before this sees
        // it.
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-2.5 shadow-xs",
        "focus-within:border-primary/40 transition-colors",
        className,
      )}
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs doing?"
        maxLength={500}
        aria-label="Task name"
        // A bare input rather than the `Input` component: inside a card that is
        // already a bordered box, a second border draws a box in a box.
        className="w-full bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
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
            disabled={!canSubmit}
            aria-label="Add task"
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </form>
  );
}
