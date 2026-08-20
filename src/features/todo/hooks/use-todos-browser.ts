"use client";

import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";

import { groupTodosByDay } from "@/features/todo/lib/group-todos-by-day";
import { todoFilterParsers, toListInput } from "@/features/todo/lib/params";
import { DAY_KEY_PATTERN, type DayKey } from "@/features/todo/lib/todo-dates";
import { useTodayKey } from "@/features/todo/hooks/use-today-key";
import { TODO_DATE_PARAM } from "@/features/todo/types";
import { useTodoView, type TodoViewType } from "@/lib/stores/todo-view-store";
import { useTRPC } from "@/trpc/client";

/**
 * The todos, cut into days, narrowed by whatever the toolbar is asking for.
 *
 * Suspends while loading and throws on failure, so the caller supplies a
 * `<Suspense>` fallback and an error boundary rather than branching here — the
 * same contract as `useNotesBrowser` and `useDriveBrowser`.
 */
export function useTodosBrowser(serverView: TodoViewType) {
  const trpc = useTRPC();

  const [filters] = useQueryStates(todoFilterParsers);

  // Not a filter: the layout is remembered in a cookie, so the server has
  // already rendered one of the two and passes down which — see
  // `todo-view-store`.
  const view = useTodoView(serverView);

  const { data: todos } = useSuspenseQuery(
    trpc.todo.list.queryOptions(toListInput(filters)),
  );

  // The day the whole page is measured from. Listed as a dependency so the
  // window and every heading are rebuilt when it rolls over at midnight —
  // React Query's structural sharing hands back the *same* `todos` array when
  // nothing has changed, so without this the page would sit on yesterday's
  // labels until something else happened to invalidate it.
  const today = useTodayKey();

  /**
   * Days the reader has been sent to by name, kept in the window for as long as
   * the page is open.
   *
   * The window on its own covers a fortnight ahead and a week back, and days
   * outside it exist only if something is filed on them. So the header's
   * calendar could point at a day this page had no section for — an empty
   * Thursday next month — and the scroll would find nothing and silently do
   * nothing. Pinning the day gives it a heading (and an "Add todo") to land on.
   *
   * Remembered rather than read live, because the parameter does not last:
   * `useTodoDayNavigation` strips it once it has scrolled, and a day that
   * vanished from the list at that moment would pull the page out from under
   * the reader who had just been taken there.
   */
  const requestedDay = useSearchParams().get(TODO_DATE_PARAM);
  const [pinnedDays, setPinnedDays] = useState<DayKey[]>([]);

  // Set during the render that first sees it, not in an effect: the section has
  // to exist in the *same* commit the scroll is queued from, and an effect
  // would render the page once without it — which is the frame the scroll
  // would run in. The parameter is checked against the day format because it
  // comes from the URL, where anything can be typed.
  if (
    requestedDay &&
    DAY_KEY_PATTERN.test(requestedDay) &&
    !pinnedDays.includes(requestedDay)
  ) {
    setPinnedDays([...pinnedDays, requestedDay]);
  }

  const groups = useMemo(
    () => groupTodosByDay(todos, today, pinnedDays),
    [todos, today, pinnedDays],
  );

  return {
    todos,
    groups,
    today,
    view,
    // An empty page means two different things, and only this knows which.
    isFiltering: filters.priority !== null || filters.modified !== null,
    // What decides whether the page keeps a clock running — see `useTodoClock`.
    hasRunningTimer: todos.some(
      (todo) => todo.timerStartedAt !== null && !todo.completed,
    ),
  };
}
