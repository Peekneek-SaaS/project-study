import { format, isToday, isYesterday } from "date-fns";

import type { StickyNote } from "@/features/sticky-notes/types";

export interface NoteDayGroup {
  /** Stable across renders and across midnight — the day itself, not its name. */
  key: string;
  /** "Today", "Yesterday", or the date written out. */
  label: string;
  notes: StickyNote[];
}

/**
 * Splits notes into the days they were written on.
 *
 * Grouped in the browser rather than by the database, because "today" is a
 * question about the reader's clock and the server does not have it — a note
 * written at 11pm belongs to that evening for the person who wrote it, whatever
 * date UTC had reached. Ordering is the server's job; this only cuts the list
 * where the day changes, so the newest-first order carries through.
 */
export function groupNotesByDay(notes: StickyNote[]): NoteDayGroup[] {
  const groups: NoteDayGroup[] = [];
  let current: NoteDayGroup | null = null;

  for (const note of notes) {
    // Timestamps arrive as ISO strings even though the router types them as
    // `Date` — no transformer is configured — so normalise, as `formatDriveDate`
    // does.
    const date = new Date(note.createdAt);
    if (Number.isNaN(date.getTime())) continue;

    // The local calendar day, which is what the headings are about.
    const key = format(date, "yyyy-MM-dd");

    if (!current || current.key !== key) {
      current = { key, label: dayLabel(date), notes: [] };
      groups.push(current);
    }

    current.notes.push(note);
  }

  return groups;
}

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";

  // The year is worth saying once a note is old enough to have one that is not
  // obvious, and costs little when it is.
  return format(date, "EEEE, MMM d, yyyy");
}
