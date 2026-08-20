import {
  dayLabel,
  shiftDayKey,
  type DayKey,
} from "@/features/todo/lib/todo-dates";
import type { Todo } from "@/features/todo/types";

/**
 * How far the page reaches on its own, before the todos have their say.
 *
 * Forward further than back, because that is the direction the page is for:
 * you plan into next week and you glance at what you missed. Both are only a
 * floor — a todo outside this window brings its day along with it, so nothing
 * is ever hidden by the numbers here.
 */
export const FUTURE_DAYS = 14;
export const PAST_DAYS = 7;

export interface TodoDayGroup {
  /** The day itself: stable across renders, and across midnight. */
  key: DayKey;
  /** "Today", "Tomorrow", "Yesterday", or the date written out. */
  label: string;
  todos: Todo[];
  /** How many are still outstanding — the number beside the heading. */
  pendingCount: number;
  isToday: boolean;
}

/**
 * The days the page shows, newest first.
 *
 * Descending is the whole navigation model: the future is *above* today and the
 * past below it, so scrolling up walks forward through the week. It is why the
 * page scrolls itself to today on arrival rather than starting at the top —
 * see `useScrollToToday`.
 *
 * Days are built from a fixed window rather than from the todos, so an empty
 * tomorrow still has a heading and an "Add task" under it. A day is only added
 * beyond that window when something is actually filed on it, which keeps a todo
 * six months out reachable without rendering the six months in between.
 *
 * `pinned` is the other way a day gets in: one the reader has asked for by
 * name, from the header's calendar. Without it, following the calendar to an
 * empty day three months out would scroll to a section that does not exist —
 * the window has no opinion about a day nobody has filed anything on.
 *
 * Grouped here rather than by the database because the window is a question
 * about the reader's today, and the server does not have their clock — the same
 * reason the notes wall groups in the browser.
 *
 * `today` is passed in rather than read here so that the window, the headings
 * and everything else on the page are measured from one answer — see
 * `useTodayKey`, which also re-renders all of it when that answer changes at
 * midnight.
 */
export interface GroupTodosOptions {
  /** Days to keep in the window whatever else is true — see above. */
  pinned?: readonly DayKey[];
  /**
   * Drop the days nothing landed on.
   *
   * For a *filtered* page, where the window's empty days are noise: asking for
   * one document's tasks and being shown a fortnight of headings with "No
   * todos" under all but two of them buries the answer in the question. Off by
   * default, because an unfiltered page is a planner — an empty tomorrow with
   * an "Add todo" under it is the point of it.
   */
  onlyWithTodos?: boolean;
}

export function groupTodosByDay(
  todos: Todo[],
  today: DayKey,
  { pinned = [], onlyWithTodos = false }: GroupTodosOptions = {},
): TodoDayGroup[] {
  const byDay = new Map<DayKey, Todo[]>();

  for (const todo of todos) {
    const day = byDay.get(todo.dueDate);
    if (day) day.push(todo);
    else byDay.set(todo.dueDate, [todo]);
  }

  const keys = new Set<DayKey>(byDay.keys());

  // The window is what gives an empty tomorrow a heading — so it is exactly
  // what a filtered page does not want. The days something was filed on are
  // already in the set above, from the todos themselves.
  if (!onlyWithTodos) {
    for (let offset = FUTURE_DAYS; offset >= -PAST_DAYS; offset--) {
      keys.add(shiftDayKey(today, offset));
    }
  }

  // Pinned days survive either way: one was asked for by name, and answering
  // with nothing at all would look like the link had failed.
  for (const day of pinned) keys.add(day);

  return (
    [...keys]
      // `yyyy-MM-dd` sorts chronologically as a string, so reversing the plain
      // comparison is all "future first" takes.
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const dayTodos = byDay.get(key) ?? [];

        return {
          key,
          label: dayLabel(key, today),
          todos: dayTodos,
          pendingCount: dayTodos.filter((todo) => !todo.completed).length,
          isToday: key === today,
        };
      })
  );
}
