// lib/stores/drive-view-store.ts
import { create } from "zustand";

/** How the drive draws its contents. */
export type DriveViewType = "list" | "grid";

/** Read by the server too — see `readDriveViewCookie`. */
export const DRIVE_VIEW_COOKIE = "drive_view";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The stored choice, or `null` when there is none to read. */
function cookieView(): DriveViewType | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${DRIVE_VIEW_COOKIE}=(list|grid)`),
  );
  return (match?.[1] as DriveViewType | undefined) ?? null;
}

interface DriveViewStore {
  view: DriveViewType;
  setView: (view: DriveViewType) => void;
}

/**
 * The list/grid switch, remembered in a cookie.
 *
 * A cookie rather than `localStorage` because the drive is server-rendered: the
 * server has to know which layout to send, and only a cookie travels with the
 * request. The store initialises from that same cookie on the client, so its
 * first render agrees with the HTML — see `useDriveView` for the server half.
 */
export const useDriveViewStore = create<DriveViewStore>((set) => ({
  view: cookieView() ?? "list",

  setView: (view) => {
    document.cookie = `${DRIVE_VIEW_COOKIE}=${view}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
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
export function useDriveView(serverView: DriveViewType) {
  const view = useDriveViewStore((state) => state.view);
  return typeof document === "undefined" ? serverView : view;
}
