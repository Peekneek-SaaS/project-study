"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";

import { todoFilterParsers, toListInput } from "@/features/todo/lib/params";
import type { TodoPriority } from "@/features/todo/lib/todo-priority";
import type { Todo } from "@/features/todo/types";
import { useTRPC } from "@/trpc/client";

/** What a create looks like before the server has given it an id. */
export interface NewTodo {
  title: string;
  dueDate: string;
  priority?: TodoPriority;
  timerSeconds?: number | null;
}

/**
 * Which list a set of writes belongs to.
 *
 * The todo page renders `todo.list`; a document's tab renders
 * `todo.listForDocument`. Optimistic writes have to land on the key the caller
 * is actually rendering from, or the click appears to do nothing until a
 * refetch — so the caller says which one it is, and every invalidation covers
 * both regardless, because one task can be on screen in both places at once.
 */
export interface TodoScope {
  /** Set on a document's tab; absent on the todo page. */
  documentId?: string | null;
}

export interface TodoPatch {
  title?: string;
  dueDate?: string;
  priority?: TodoPriority;
  timerSeconds?: number | null;
}

/**
 * Everything that writes a todo, painted before it is saved.
 *
 * Every one of these is a single deliberate click on something that is meant to
 * respond like an object — a tick box, a play button, a day chip. So every one
 * of them writes the cache first and reconciles after, rather than waiting on a
 * round trip: a checkbox that ticks 200ms late reads as a checkbox that did not
 * work, and the user clicks it again.
 *
 * The cache key is built from the live filters rather than left bare, for the
 * reason `useNoteMutations` spells out: `list` is cached per filter, so an
 * optimistic write under the unfiltered key lands on a query nothing is
 * rendering and the click appears to do nothing until a refetch.
 */
export function useTodoMutations({ documentId }: TodoScope = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [filters] = useQueryStates(todoFilterParsers);

  // Memoised on the filter values rather than rebuilt each render. These are
  // dependencies of every callback below, and a fresh object each time makes
  // all of them fresh too — which is how a consumer's effect ends up re-running
  // on every render of the row it lives in. `TodoItem`'s auto-complete is
  // exactly such an effect.
  const { listKey, listFilters, calendarFilter } = useMemo(
    () => ({
      // The exact key the caller renders from — what optimistic writes must
      // land on.
      listKey: documentId
        ? trpc.todo.listForDocument.queryKey({ documentId })
        : trpc.todo.list.queryKey(
            toListInput({
              priority: filters.priority,
              modified: filters.modified,
              documents: filters.documents,
            }),
          ),
      // Deliberately broader, and deliberately both: every filtered variant of
      // the page's list, plus every document's tab. A todo whose priority just
      // changed may belong in or out of a list this page is not currently
      // showing, and a document's task is on the page as well as on its tab —
      // so whichever of the two was painted, the other has to be refetched.
      listFilters: [
        trpc.todo.list.queryFilter(),
        trpc.todo.listForDocument.queryFilter(),
      ],
      calendarFilter: trpc.todo.calendar.queryFilter(),
    }),
    [documentId, filters.documents, filters.modified, filters.priority, trpc],
  );

  // `mutateAsync` is pulled off each mutation rather than the result object
  // being kept, because that function is the only stable thing React Query
  // hands back — the object around it is rebuilt every render. Depending on the
  // object would make every callback below a new function each render, and an
  // effect downstream that lists one as a dependency would re-run constantly.
  // `TodoItem`'s auto-complete is exactly such an effect.
  const { mutateAsync: createTodoMutation, isPending: isCreating } = useMutation(
    trpc.todo.create.mutationOptions(),
  );
  const { mutateAsync: updateTodoMutation } = useMutation(
    trpc.todo.update.mutationOptions(),
  );
  const { mutateAsync: setCompletedMutation } = useMutation(
    trpc.todo.setCompleted.mutationOptions(),
  );
  const { mutateAsync: setTimerMutation } = useMutation(
    trpc.todo.setTimerRunning.mutationOptions(),
  );
  const { mutateAsync: removeTodoMutation } = useMutation(
    trpc.todo.remove.mutationOptions(),
  );
  const { mutateAsync: removeManyMutation } = useMutation(
    trpc.todo.removeMany.mutationOptions(),
  );
  const { mutateAsync: clearDayMutation } = useMutation(
    trpc.todo.clearDay.mutationOptions(),
  );

  /**
   * Runs a write with the cache already showing its result.
   *
   * The rollback is the whole point of holding `previous`: an optimistic paint
   * that failed is worse than one that never happened, because it looks saved.
   * The refetch afterwards is what settles temporary ids and any ordering the
   * server decided differently.
   */
  const optimistically = useCallback(
    async <Result,>(
      paint: (todos: Todo[]) => Todo[],
      write: () => Promise<Result>,
      failure: string,
    ) => {
      // Cancelled first: an in-flight refetch that resolves after the paint
      // would overwrite it with the pre-click list.
      await Promise.all(
        listFilters.map((filter) => queryClient.cancelQueries(filter)),
      );

      const previous = queryClient.getQueryData<Todo[]>(listKey);
      queryClient.setQueryData<Todo[]>(listKey, (todos) =>
        todos ? paint(todos) : todos,
      );

      try {
        const result = await write();
        // Both, and both after the write: the list because the server may have
        // decided a position or a sweep we did not predict, the calendar
        // because the header's dots are counting these rows.
        await Promise.all([
          ...listFilters.map((filter) => queryClient.invalidateQueries(filter)),
          queryClient.invalidateQueries(calendarFilter),
        ]);
        return result;
      } catch (error) {
        if (previous) queryClient.setQueryData(listKey, previous);
        toast.error(error instanceof Error ? error.message : failure);
        return null;
      }
    },
    [calendarFilter, listFilters, listKey, queryClient],
  );

  const createTodo = useCallback(
    async (input: NewTodo) => {
      const title = input.title.trim();
      if (!title) return null;

      // A stand-in row so the task appears under the cursor rather than after
      // the round trip. Appended rather than inserted at a position, which is
      // enough: `groupTodosByDay` keeps each day's rows in the order it met
      // them, so the end of the array is the end of that day's section — which
      // is exactly where "Add task" sits.
      const optimistic: Todo = {
        id: `optimistic-${crypto.randomUUID()}`,
        title,
        // What the row is about, if anything. The chip that names the document
        // is left null until the refetch: the hook knows the id it was scoped
        // to, not the document's name, and a tab is the one place the chip
        // would say nothing anybody there does not already know.
        documentId: documentId ?? null,
        document: null,
        dueDate: input.dueDate,
        priority: input.priority ?? "NONE",
        completed: false,
        completedAt: null,
        timerSeconds: input.timerSeconds ?? null,
        timerStartedAt: null,
        timerElapsed: 0,
        position: Number.MAX_SAFE_INTEGER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return optimistically(
        (todos) => [...todos, optimistic],
        () =>
          createTodoMutation({
            title,
            dueDate: input.dueDate,
            priority: input.priority,
            timerSeconds: input.timerSeconds,
            documentId,
          }),
        "Could not add the task",
      );
    },
    [createTodoMutation, documentId, optimistically],
  );

  const updateTodo = useCallback(
    async (id: string, patch: TodoPatch) =>
      optimistically(
        (todos) =>
          todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  ...patch,
                  // Mirrors the router: changing a timer restarts it, so the
                  // optimistic row must not go on showing the old countdown.
                  ...(patch.timerSeconds !== undefined && {
                    timerStartedAt: null,
                    timerElapsed: 0,
                  }),
                }
              : todo,
          ),
        () => updateTodoMutation({ id, ...patch }),
        "Could not update the task",
      ),
    [optimistically, updateTodoMutation],
  );

  const setCompleted = useCallback(
    async (id: string, completed: boolean) =>
      optimistically(
        (todos) =>
          todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  completed,
                  completedAt: completed ? new Date().toISOString() : null,
                  ...(completed && { timerStartedAt: null }),
                }
              : todo,
          ),
        () => setCompletedMutation({ id, completed }),
        "Could not update the task",
      ),
    [optimistically, setCompletedMutation],
  );

  const setTimerRunning = useCallback(
    async (id: string, action: "start" | "pause" | "reset") =>
      optimistically(
        (todos) =>
          todos.map((todo) => {
            if (todo.id !== id) return todo;

            if (action === "start") {
              return {
                ...todo,
                timerStartedAt: new Date().toISOString(),
                completed: false,
                completedAt: null,
              };
            }

            if (action === "reset") {
              return { ...todo, timerStartedAt: null, timerElapsed: 0 };
            }

            // Pause banks the stretch locally so the countdown freezes on the
            // number that was on screen. The server recomputes it from its own
            // clock and the refetch replaces this with that.
            const stretch = todo.timerStartedAt
              ? Math.round(
                  (Date.now() - new Date(todo.timerStartedAt).getTime()) / 1000,
                )
              : 0;

            return {
              ...todo,
              timerStartedAt: null,
              timerElapsed: Math.min(
                todo.timerSeconds ?? 0,
                todo.timerElapsed + stretch,
              ),
            };
          }),
        () => setTimerMutation({ id, action }),
        "Could not update the timer",
      ),
    [optimistically, setTimerMutation],
  );

  const removeTodo = useCallback(
    async (id: string) =>
      optimistically(
        (todos) => todos.filter((todo) => todo.id !== id),
        () => removeTodoMutation({ id }),
        "Could not delete the task",
      ),
    [optimistically, removeTodoMutation],
  );

  /** Everything the selection bar has ticked, in one request. */
  const removeTodos = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return null;

      const removing = new Set(ids);

      return optimistically(
        (todos) => todos.filter((todo) => !removing.has(todo.id)),
        () => removeManyMutation({ ids }),
        ids.length === 1
          ? "Could not delete the task"
          : "Could not delete those tasks",
      );
    },
    [optimistically, removeManyMutation],
  );

  const clearDay = useCallback(
    async (dueDate: string, completedOnly: boolean) =>
      optimistically(
        (todos) =>
          todos.filter(
            (todo) =>
              todo.dueDate !== dueDate || (completedOnly && !todo.completed),
          ),
        // Narrowed to the document when this is a document's tab, so clearing
        // a day there is about this document's day and not the user's.
        () => clearDayMutation({ dueDate, completedOnly, documentId }),
        "Could not clear the day",
      ),
    [clearDayMutation, documentId, optimistically],
  );

  return {
    createTodo,
    updateTodo,
    setCompleted,
    setTimerRunning,
    removeTodo,
    removeTodos,
    clearDay,
    isCreating,
  };
}
