import { dayLabel, shiftDayKey, type DayKey } from "@/features/todo/lib/todo-dates";
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
 * Grouped here rather than by the database because the window is a question
 * about the reader's today, and the server does not have their clock — the same
 * reason the notes wall groups in the browser.
 *
 * `today` is passed in rather than read here so that the window, the headings
 * and everything else on the page are measured from one answer — see
 * `useTodayKey`, which also re-renders all of it when that answer changes at
 * midnight.
 */
export function groupTodosByDay(todos: Todo[], today: DayKey): TodoDayGroup[] {
  const byDay = new Map<DayKey, Todo[]>();

  for (const todo of todos) {
    const day = byDay.get(todo.dueDate);
    if (day) day.push(todo);
    else byDay.set(todo.dueDate, [todo]);
  }

  const keys = new Set<DayKey>(byDay.keys());
  for (let offset = FUTURE_DAYS; offset >= -PAST_DAYS; offset--) {
    keys.add(shiftDayKey(today, offset));
  }

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
