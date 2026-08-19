"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { groupTodosByDay } from "@/features/todo/lib/group-todos-by-day";
import { todoFilterParsers, toListInput } from "@/features/todo/lib/params";
import { useTodayKey } from "@/features/todo/hooks/use-today-key";
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

  const groups = useMemo(
    () => groupTodosByDay(todos, today),
    [todos, today],
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
