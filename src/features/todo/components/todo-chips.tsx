"use client";

import { useState } from "react";
import { CalendarIcon, Flag, Timer, TimerOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  dayKeyFromToday,
  dayLabel,
  longDayLabel,
  parseDayKey,
  toDayKey,
  type DayKey,
} from "@/features/todo/lib/todo-dates";
import {
  priorityMeta,
  TODO_PRIORITIES,
  type TodoPriority,
} from "@/features/todo/lib/todo-priority";
import { formatDuration, TIMER_OPTIONS } from "@/features/todo/lib/todo-timer";
import { cn } from "@/lib/utils";

/**
 * The three chips a todo is described with, in the composer and again in the
 * menu of a todo that already exists.
 *
 * Shared rather than written twice because they are the same decision in both
 * places: "when", "how long", "how loud". Writing them once means a task edited
 * later is edited with the controls it was created with, which is most of what
 * makes an editable thing feel like the same thing.
 *
 * Each is a button that says its current value rather than a labelled field
 * with a control beside it. At this size a chip *is* the label — "Tomorrow"
 * says more than "Date: Tomorrow" in half the room — and the row of them reads
 * as a sentence about the task.
 */
const chipClassName =
  "h-8 gap-1.5 rounded-full border border-input px-3 text-xs font-normal shadow-none hover:bg-accent";

/** Marks a chip that is carrying a value, so "set" is visible from a glance. */
const activeChipClassName = "border-primary/40 bg-primary/5 text-foreground";

export function TodoDateChip({
  value,
  onChange,
  className,
}: {
  value: DayKey;
  onChange: (day: DayKey) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const pick = (day: DayKey) => {
    onChange(day);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={longDayLabel(value)}
          className={cn(chipClassName, activeChipClassName, className)}
        >
          <CalendarIcon className="size-3.5" />
          {dayLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/*
          The three days that are most of the answers, above the calendar rather
          than inside it. Picking "Tomorrow" from a grid of numbers means working
          out which number tomorrow is, which is a question the page already
          knows the answer to.
        */}
        <div className="flex flex-col p-1">
          {[
            { label: "Today", offset: 0 },
            { label: "Tomorrow", offset: 1 },
            { label: "Next week", offset: 7 },
          ].map((shortcut) => {
            const day = dayKeyFromToday(shortcut.offset);
            return (
              <Button
                key={shortcut.label}
                type="button"
                variant="ghost"
                size="sm"
                className="justify-between font-normal"
                onClick={() => pick(day)}
              >
                {shortcut.label}
                <span className="text-xs text-muted-foreground">
                  {dayLabel(day)}
                </span>
              </Button>
            );
          })}
        </div>

        <Separator />

        <Calendar
          mode="single"
          // Parsed to a local midnight, which is the only reading that agrees
          // with what the reader sees on their own calendar — see `todo-dates`.
          selected={parseDayKey(value)}
          defaultMonth={parseDayKey(value)}
          onSelect={(date) => date && pick(toDayKey(date))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function TodoTimerChip({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (seconds: number | null) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="How long will this take?"
          className={cn(
            chipClassName,
            value !== null && activeChipClassName,
            className,
          )}
        >
          <Timer className="size-3.5" />
          {value === null ? "Timer" : formatDuration(value)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {TIMER_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className={cn(value === option.value && "bg-accent")}
          >
            <Timer />
            {option.label}
          </DropdownMenuItem>
        ))}

        {/* Only offered once there is a timer to take off. */}
        {value !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>
              <TimerOff />
              No timer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TodoPriorityChip({
  value,
  onChange,
  className,
}: {
  value: TodoPriority;
  onChange: (priority: TodoPriority) => void;
  className?: string;
}) {
  const meta = priorityMeta(value);
  const isSet = value !== "NONE";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Priority"
          className={cn(
            chipClassName,
            isSet && activeChipClassName,
            className,
          )}
        >
          <Flag className={cn("size-3.5", isSet && meta.className)} />
          {isSet ? meta.label : "Priority"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {TODO_PRIORITIES.map((priority) => (
          <DropdownMenuItem
            key={priority.value}
            onSelect={() => onChange(priority.value)}
            className={cn(value === priority.value && "bg-accent")}
          >
            <Flag className={priority.className} />
            {priority.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
