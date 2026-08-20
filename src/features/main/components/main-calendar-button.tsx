"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  parseDayKey,
  toDayKey,
  todayKey,
} from "@/features/todo/lib/todo-dates";
import { TODO_PATH, todoDatePath } from "@/features/todo/types";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * A minute. The day counts change only when the user changes them — and every
 * one of those invalidates the `todo` router — so this is not about catching
 * writes, it is about a tab left open across midnight eventually noticing.
 */
const CALENDAR_STALE_TIME = 60 * 1000;

/**
 * The month, in the header, with the days that have work on them marked.
 *
 * The dot on the button answers one question without being opened: is there
 * anything to do. It counts today and everything after it and not the days
 * behind, because a dot that stayed lit for a task missed last week would be
 * lit permanently and would stop meaning anything.
 *
 * The counts come from their own procedure rather than from the todo page's
 * list. This is mounted on every page in the app, and shipping every task's
 * title to draw a handful of dots would make the header the largest request on
 * most of them.
 */
const MainCalendarButton = () => {
  const trpc = useTRPC();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  // Not a suspense query: the header is above every page's boundary, and one
  // that suspended here would hold up the whole app for a decoration.
  const { data: days } = useQuery({
    ...trpc.todo.calendar.queryOptions(),
    staleTime: CALENDAR_STALE_TIME,
  });

  const { pendingDays, doneDays, hasUpcoming } = useMemo(() => {
    const today = todayKey();
    const all = days ?? [];

    return {
      // Split so the calendar can say the two things apart: a day with work
      // left, and a day that is finished. Both are worth a mark — a month with
      // no dots at all reads as a month you did nothing in.
      pendingDays: all
        .filter((day) => day.pending > 0)
        .map((day) => parseDayKey(day.date)),
      doneDays: all
        .filter((day) => day.pending === 0 && day.total > 0)
        .map((day) => parseDayKey(day.date)),
      hasUpcoming: all.some((day) => day.pending > 0 && day.date >= today),
    };
  }, [days]);

  const goToDay = (day: string) => {
    setOpen(false);
    router.push(todoDatePath(day));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={
            hasUpcoming ? "Calendar — you have tasks due" : "Calendar"
          }
          className="relative"
        >
          <CalendarDays />

          {/*
            Outside the button's box rather than inside it: the icon fills the
            square, and a dot placed within would sit on top of the glyph. The
            ring in the background colour is what keeps it legible where it
            overlaps the border.
          */}
          {hasUpcoming && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary ring-2 ring-background"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={undefined}
          // The default cell is 1.5rem, which leaves the dot sitting on the
          // numeral. A larger cell gives the two room to stack, and the gaps
          // below keep the days from reading as one continuous block.
          className="[--cell-size:--spacing(9)]"
          classNames={{
            weekdays: "flex gap-1",
            week: "mt-1 flex w-full gap-1",
          }}
          onSelect={(date) => date && goToDay(toDayKey(date))}
          modifiers={{ hasPending: pendingDays, hasDone: doneDays }}
          components={{
            // The dot is drawn on the day *button* rather than through
            // `modifiersClassNames`, which lands on the cell around it — the
            // button is the thing that is already `relative`, and the thing
            // that turns primary when selected, so both the dot's position and
            // its contrast colour follow it for free.
            DayButton: ({ modifiers, className, ...props }) => (
              <CalendarDayButton
                modifiers={modifiers}
                className={cn(
                  (modifiers.hasPending || modifiers.hasDone) &&
                    "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:content-['']",
                  modifiers.hasPending && "after:bg-primary",
                  modifiers.hasDone && "after:bg-muted-foreground/40",
                  // On the selected day the square is already primary, so a
                  // primary dot on it is an invisible dot.
                  "data-[selected-single=true]:after:bg-primary-foreground",
                  className,
                )}
                {...props}
              />
            ),
          }}
          autoFocus
        />

        <Separator />

        <div className="flex items-center justify-between gap-2 p-2">
          {/* <span className="pl-1 text-xs text-muted-foreground">
            Pick a day to open it
          </span> */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToDay(todayKey())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push(TODO_PATH);
              }}
            >
              All tasks
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MainCalendarButton;
