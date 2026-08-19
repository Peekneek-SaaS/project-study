// lib/stores/todo-view-store.ts
import { create } from "zustand";

/** The two ways the days can be drawn. See `TodoBoard`. */
export type TodoViewType = "list" | "grid";

/** Read by the server too — see `readTodoViewCookie`. */
export const TODO_VIEW_COOKIE = "todo_view";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The stored choice, or `null` when there is none to read. */
function cookieView(): TodoViewType | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${TODO_VIEW_COOKIE}=(list|grid)`),
  );
  return (match?.[1] as TodoViewType | undefined) ?? null;
}

interface TodoViewStore {
  view: TodoViewType;
  setView: (view: TodoViewType) => void;
}

/**
 * The list/grid switch, remembered in a cookie — the drive's arrangement, for
 * the drive's reason.
 *
 * A cookie rather than `localStorage` because this page is server-rendered: the
 * server has to know which layout to send, and only a cookie travels with the
 * request. It is also why this is no longer a search param. The URL was the
 * honest place for it while the page had nothing to remember, but a param has
 * no memory — every fresh visit arrives with no `view` and opens on the
 * default, which is exactly what "remember my view" asks it not to do.
 */
export const useTodoViewStore = create<TodoViewStore>((set) => ({
  view: cookieView() ?? "list",

  setView: (view) => {
    document.cookie = `${TODO_VIEW_COOKIE}=${view}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    set({ view });
  },
}));

/**
 * The view to draw, on either side of the wire.
 *
 * This store is a module singleton, so it cannot be seeded per request on the
 * server — a second visitor would inherit the first one's layout. Instead the
 * server passes what it read from the cookie, the client reads the same cookie
 * for itself, and the two agree without anything being written across requests.
 */
export function useTodoView(serverView: TodoViewType) {
  const view = useTodoViewStore((state) => state.view);
  return typeof document === "undefined" ? serverView : view;
}
