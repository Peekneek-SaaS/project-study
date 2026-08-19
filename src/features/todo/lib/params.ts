import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { TODO_PRIORITY_VALUES } from "@/features/todo/lib/todo-priority";
import { MODIFIED_VALUES } from "@/lib/list-filters";

/**
 * The todo page's filters, as URL search params.
 *
 * The URL is the single source of truth, as it is on the notes wall: the
 * toolbar writes here through `useQueryStates`, `useTodosBrowser` puts the same
 * values straight into the `list` input, and `loadTodoFilters` parses them on
 * the server so the page prefetches the *filtered* list rather than one the
 * client would immediately replace.
 *
 * The list/grid switch is deliberately *not* here. It is not a question about
 * which tasks you are looking at, it is a habit — and a habit has to survive
 * arriving with a bare `/todo`, which a search param cannot. It lives in a
 * cookie instead, the way the drive's does: see `todo-view-store`.
 */
export const todoFilterParsers = {
  priority: parseAsStringLiteral(TODO_PRIORITY_VALUES),
  modified: parseAsStringLiteral(MODIFIED_VALUES),
};

/**
 * Just what the router takes.
 *
 * Which is, at present, all of it — the shape is kept so that a filter the
 * server has no opinion about can be added to the toolbar without every caller
 * of `list` having to learn to strip it.
 */
export function toListInput(filters: {
  priority: (typeof TODO_PRIORITY_VALUES)[number] | null;
  modified: (typeof MODIFIED_VALUES)[number] | null;
}) {
  return { priority: filters.priority, modified: filters.modified };
}

/** Server-side reader for the above. Takes a page's `searchParams` promise. */
export const loadTodoFilters = createLoader(todoFilterParsers);
