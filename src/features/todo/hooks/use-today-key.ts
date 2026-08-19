"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import { todayKey, type DayKey } from "@/features/todo/lib/todo-dates";

/**
 * Which day it is, according to the reader.
 *
 * The single answer the whole page is built from: the day window is measured
 * out from it, the headings are named against it, and "overdue" is decided by
 * it. Everything reads this one value rather than calling the clock separately,
 * because two callers a millisecond either side of midnight would otherwise
 * disagree and the page would render a day that is both Today and Yesterday.
 *
 * It is a store subscription for two reasons, and both matter.
 *
 * The first is midnight. A page left open overnight has to notice: yesterday's
 * heading has to become "Two days ago" and today's has to become "Yesterday",
 * with the new today appearing beneath. So this schedules a wake-up for the
 * next local midnight and re-renders everything reading it — nothing is
 * rewritten, the labels are simply derived again from a day that has moved.
 *
 * The second is that the server and the reader can disagree about the date. The
 * server renders in its own timezone, which for a user several hours west is
 * already tomorrow by late evening. `useSyncExternalStore` is the hook built
 * for exactly this: it takes the server's answer for the server's render, and
 * if the client's differs it re-renders with the client's rather than leaving
 * mismatched markup in place. Reading the clock in `useState` would silently
 * keep the server's date for the life of the page.
 */
export function useTodayKey(): DayKey {
  const cached = useRef<DayKey | null>(null);

  const subscribe = useCallback((onDayChange: () => void) => {
    let timeout: number | undefined;

    const scheduleNextMidnight = () => {
      // Hour 24 of today is hour 0 of tomorrow, local — and going through the
      // Date object rather than adding 86,400,000ms is what keeps it right
      // across the days that are not 24 hours long, which is every daylight
      // saving changeover.
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      timeout = window.setTimeout(
        () => {
          cached.current = todayKey();
          onDayChange();
          scheduleNextMidnight();
        },
        // A second past the hour, so the timer firing a hair early cannot read
        // the clock back as the day it was meant to leave.
        midnight.getTime() - Date.now() + 1000,
      );
    };

    cached.current = todayKey();
    onDayChange();
    scheduleNextMidnight();

    return () => window.clearTimeout(timeout);
  }, []);

  // Stable by value before the subscription lands: two calls in the same render
  // return the same string, which is all `useSyncExternalStore` asks for.
  const getSnapshot = useCallback(() => cached.current ?? todayKey(), []);
  const getServerSnapshot = useCallback(() => todayKey(), []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
