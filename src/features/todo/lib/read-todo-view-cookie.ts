import { cookies } from "next/headers";

import {
  TODO_VIEW_COOKIE,
  type TodoViewType,
} from "@/lib/stores/todo-view-store";

/**
 * The view the visitor last chose, for the server to render.
 *
 * The drive's `readDriveViewCookie`, for this page's cookie: read on the server
 * so the first paint is already the right layout, rather than a list that turns
 * into a grid once JavaScript arrives.
 */
export async function readTodoViewCookie(): Promise<TodoViewType> {
  const cookieStore = await cookies();
  return cookieStore.get(TODO_VIEW_COOKIE)?.value === "grid" ? "grid" : "list";
}
