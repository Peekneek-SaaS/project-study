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
import { MAX_TODO_TITLE } from "@/features/todo/lib/todo-title";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
  onCreated,
  initialTitle = "",
  autoFocus = true,
  className,
  documentId,
}: {
  day: DayKey;
  onClose: () => void;
  /**
   * Called once a task has been added, where adding one is the end of
   * something rather than the middle of it.
   *
   * Absent on the page, and deliberately: a composer there clears its field and
   * waits for the next task, because tasks arrive in handfuls. Somewhere the
   * composer was opened to write down *one* particular thing — the paste
   * picker, which opens it on an excerpt; the drive's New Todo — there is
   * nothing to wait for, and the caller says so by passing this.
   *
   * Handed the day the task was filed under rather than the day the composer
   * opened on, because the date chip may have moved it: a caller that reports
   * where the task went, or travels there, has to be told where it actually
   * went.
   */
  onCreated?: (dueDate: DayKey) => void;
  /**
   * The title to start from, for a composer opened on something already
   * written. Only the first render's value is read: after that the field is the
   * user's, and a task typed over the top of a paste is not to be reverted.
   */
  initialTitle?: string;
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

  const [title, setTitle] = useState(initialTitle);
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

    // Whoever opened this for one task takes it from here — usually by
    // unmounting the composer, which is why nothing below runs for them.
    if (onCreated) {
      onCreated(pending.dueDate);
      return;
    }

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
        "flex flex-col gap-2 border bg-card p-2.5 shadow-xs",
        "focus-within:border-primary/40 transition-colors",
        className,
      )}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs doing?"
        maxLength={MAX_TODO_TITLE}
        aria-label="Task name"
        /*
          Stripped back to the text and nothing else, in every state.

          The card around it is already a bordered box that lights up on focus —
          see the form — so an input with its own border, background and focus
          ring draws a box inside a box and the two rings fire together. Width
          rather than style is what is taken off (`border-0`, not
          `border-none`), because the component sets a border *width* and only a
          width can override it; the same for the rings, which are cleared on
          `focus-visible` and on `aria-invalid` rather than only at rest, or the
          box would come back the moment the field was typed in.
        */
        className={cn(
          "w-full border-0 bg-transparent px-1 text-sm shadow-none outline-none",
          "placeholder:text-muted-foreground dark:bg-transparent",
          "focus-visible:border-0 focus-visible:ring-0",
          "aria-invalid:border-0 aria-invalid:ring-0",
        )}
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
