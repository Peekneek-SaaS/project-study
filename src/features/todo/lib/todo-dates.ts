import { addDays, format, parse } from "date-fns";

/**
 * A calendar day, written `yyyy-MM-dd`.
 *
 * The currency of this whole feature. Every todo carries one, every section is
 * headed by one, the URL names one, and the router speaks nothing else — so
 * "which day is this under" is never a question about clocks, only about
 * string equality.
 *
 * Lexicographic order is chronological order for this format, which is why the
 * sorts below are plain string comparisons and why the router can range over
 * days without parsing anything.
 */
export type DayKey = string;

/** Matches the format above, and nothing else. The router validates with this. */
export const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A `Date` as the day it is *locally*.
 *
 * `format` and not `toISOString`: the second one converts to UTC first, so for
 * anyone west of Greenwich an evening turns into tomorrow. This is the one
 * direction where that mistake is easy to make and invisible until someone in
 * another timezone reports that their todos are filed a day late.
 */
export function toDayKey(date: Date): DayKey {
  return format(date, "yyyy-MM-dd");
}

/**
 * A day key back to a `Date` at local midnight.
 *
 * For the things that need a real date object — the calendar's selection, the
 * `isToday` family below. `parse` rather than `new Date(key)`, because the
 * string constructor reads a bare `yyyy-MM-dd` as UTC midnight and hands back
 * the previous evening in any western timezone.
 */
export function parseDayKey(key: DayKey): Date {
  return parse(key, "yyyy-MM-dd", new Date());
}

/** Today, as a key. Read at call time — this page is open across midnight. */
export function todayKey(): DayKey {
  return toDayKey(new Date());
}

/** `offset` days from today, as a key. Negative goes back. */
export function dayKeyFromToday(offset: number): DayKey {
  return toDayKey(addDays(new Date(), offset));
}

/** Shifts a key by whole days. */
export function shiftDayKey(key: DayKey, days: number): DayKey {
  return toDayKey(addDays(parseDayKey(key), days));
}

/**
 * What a day is called in the headings.
 *
 * The three relative names are the point of the page — they are what make a
 * list of dates read as "now". They are worked out by comparing keys against a
 * `today` that is *passed in* rather than read from the clock here, which is
 * what lets the whole page agree on which day it is: `useTodayKey` owns that
 * answer, re-renders everything at midnight when it changes, and is the same
 * value the day window was built from. A label that consulted the clock itself
 * could disagree with the section it is sitting on.
 *
 * The default is for the callers with no page state to thread it through — the
 * composer's date chip, a tooltip — where being a moment stale across midnight
 * costs nothing.
 */
export function dayLabel(key: DayKey, today: DayKey = todayKey()): string {
  if (key === today) return "Today";
  if (key === shiftDayKey(today, 1)) return "Tomorrow";
  if (key === shiftDayKey(today, -1)) return "Yesterday";

  const date = parseDayKey(key);

  // The weekday is the useful half at this distance — "Sat, Aug 22" tells you
  // more about your week than the number alone. The year appears only once the
  // day is far enough away that it is not obvious.
  return format(date, isSameYear(date) ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}

/** The unabbreviated form, for tooltips and the composer's date chip. */
export function longDayLabel(key: DayKey): string {
  const date = parseDayKey(key);
  return format(date, isSameYear(date) ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy");
}

function isSameYear(date: Date) {
  return date.getFullYear() === new Date().getFullYear();
}

/**
 * Whether a key is before today — what marks a day's todos as overdue.
 *
 * A string comparison, which is exact for this format and needs no clock of its
 * own beyond the `today` it is given.
 */
export function isPastDay(key: DayKey, today: DayKey = todayKey()): boolean {
  return key < today;
}
