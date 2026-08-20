"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CalendarIcon, ChevronLeft, Flag, Timer, TimerOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  formatDuration,
  MAX_TIMER_SECONDS,
  TIMER_OPTIONS,
} from "@/features/todo/lib/todo-timer";
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
  "h-8 gap-1.5  border border-input px-3 text-xs font-normal shadow-none hover:bg-accent";

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
        {/* <div className="flex flex-col p-1">
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

        <Separator /> */}

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

/**
 * A timer this short is not a timer — and the router refuses it.
 *
 * One minute, which is also the floor `todo.create` and `todo.update` validate
 * against. Named here so the picker can grey its button out rather than let the
 * save fail on a limit the user was never shown.
 */
const MIN_TIMER_SECONDS = 60;

/** The two columns' contents. A day is the ceiling, so hours stop at 24. */
const HOUR_VALUES = Array.from({ length: 25 }, (_, hour) => hour);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, minute) => minute);

/**
 * One scrolling column of numbers.
 *
 * A list to run a thumb down rather than a field to type into: "an hour and a
 * half" is picked, not spelled, and a pair of number inputs asked people to
 * type an estimate they were only ever going to point at.
 *
 * The chosen row is scrolled to the middle when the column appears, by writing
 * the viewport's `scrollTop` rather than calling `scrollIntoView` — that one
 * walks up every scrollable ancestor, and the nearest ancestors here are a
 * dropdown inside a page that would both go for a ride.
 */
function TimerColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const option = selectedRef.current;
    const viewport = option?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!option || !viewport) return;

    viewport.scrollTop =
      option.offsetTop - viewport.clientHeight / 2 + option.clientHeight / 2;
    // On appearing, and never again: re-centring as the user picks would drag
    // the list out from under the pointer between one click and the next.
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-center text-[0.625rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>

      <ScrollArea className="h-36 rounded-md border">
        <div className="flex flex-col p-1">
          {values.map((option) => (
            <button
              key={option}
              ref={option === selected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(option)}
              aria-pressed={option === selected}
              className={cn(
                "rounded-sm py-1 text-center text-xs tabular-nums transition-colors",
                option === selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {String(option).padStart(2, "0")}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
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
  const [open, setOpen] = useState(false);

  /**
   * Which of the menu's two faces is showing.
   *
   * A step rather than a panel below the presets, because both are lists and
   * two scrolling lists inside a scrolling menu is three things fighting for
   * the same wheel. The list of lengths is what opens; "Custom" swaps to the
   * columns, and the arrow swaps back.
   */
  const [isCustom, setIsCustom] = useState(false);

  /**
   * The custom length, as the two numbers it is made of.
   *
   * Seconds are deliberately not among them. "How long will this take" is not a
   * question anybody answers to the second, so every custom length lands on
   * `:00` — a third column would make this read as a countdown being set rather
   * than an estimate being made.
   */
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const custom = hours * 3600 + minutes * 60;
  const canSetCustom =
    custom >= MIN_TIMER_SECONDS && custom <= MAX_TIMER_SECONDS;

  const applyCustom = () => {
    if (!canSetCustom) return;
    onChange(custom);
    setOpen(false);
  };

  return (
    <DropdownMenu
      open={open}
      // Seeded from whatever the chip is already carrying, so opening this on a
      // task with "1 hr 30 min" offers those two numbers to adjust rather than
      // an empty pair to retype.
      onOpenChange={(next) => {
        if (next) {
          const seconds = value ?? 0;
          setHours(Math.floor(seconds / 3600));
          setMinutes(Math.floor((seconds % 3600) / 60));
          // Always opens on the lengths. The custom columns are the long way
          // round, and a menu that remembered them would make the short way
          // round take a click to get back to.
          setIsCustom(false);
        }
        setOpen(next);
      }}
    >
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
      <DropdownMenuContent
        align="start"
        // Sized to whichever face is showing: the lengths are a long list that
        // scrolls, the columns are a fixed block that must not.
        className={cn(isCustom ? "w-60" : "max-h-72 overflow-y-auto")}
        // The columns are lists of their own, and a menu reads keystrokes as
        // typeahead — without this, arrowing down a column would move the
        // menu's highlight instead.
        onKeyDown={(event) => {
          if (isCustom) event.stopPropagation();
        }}
      >
        {isCustom ? (
          <div className="p-1">
            <div className="flex items-center gap-1 pb-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Back to the lengths"
                className="size-6"
                onClick={() => setIsCustom(false)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-xs font-medium">Custom</span>
              {/* What the two columns currently add up to, said the way the
                  chip will say it — so the answer is readable before it is
                  committed to. */}
              <span className="ml-auto pr-1 text-xs text-muted-foreground tabular-nums">
                {canSetCustom ? formatDuration(custom) : "—"}
              </span>
            </div>

            <div className="flex gap-2">
              <TimerColumn
                label="hours"
                values={HOUR_VALUES}
                selected={hours}
                onSelect={setHours}
              />
              <TimerColumn
                label="min"
                values={MINUTE_VALUES}
                selected={minutes}
                onSelect={setMinutes}
              />
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-2 h-7 w-full text-xs"
              // The bounds are the router's own — a minute at the floor, a day
              // at the ceiling. Refusing here beats a save that fails after the
              // editor has closed, naming a limit nobody was shown.
              disabled={!canSetCustom}
              onClick={applyCustom}
            >
              {custom > MAX_TIMER_SECONDS
                ? "A day at most"
                : custom < MIN_TIMER_SECONDS
                  ? "A minute at least"
                  : "Set timer"}
            </Button>
          </div>
        ) : (
          <>
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

            <DropdownMenuSeparator />

            {/* Kept open on select: this one leads somewhere rather than
                answering. */}
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setIsCustom(true);
              }}
            >
              <Timer />
              Custom…
            </DropdownMenuItem>

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
          className={cn(chipClassName, isSet && activeChipClassName, className)}
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
