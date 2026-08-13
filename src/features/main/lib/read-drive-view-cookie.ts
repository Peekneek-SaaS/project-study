import { cookies } from "next/headers";

import {
  DRIVE_VIEW_COOKIE,
  type DriveViewType,
} from "@/lib/stores/drive-view-store";

/**
 * The view the visitor last chose, for the server to render.
 *
 * Same shape as the sidebar's `sidebar_state` cookie in the route layout: read
 * on the server so the first paint is already the right layout, rather than a
 * list that turns into a grid once JavaScript arrives.
 */
export async function readDriveViewCookie(): Promise<DriveViewType> {
  const cookieStore = await cookies();
  return cookieStore.get(DRIVE_VIEW_COOKIE)?.value === "grid" ? "grid" : "list";
}
