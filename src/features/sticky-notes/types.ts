import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** A note as the grid renders it. */
export type StickyNote = RouterOutputs["stickyNote"]["list"][number];

export const STICKY_NOTES_PATH = "/sticky-notes";

/**
 * The notes page, pointed at one note.
 *
 * A query parameter rather than a store, because the thing asking is usually on
 * another page — the search palette, the create dropdown — and a parameter
 * survives the navigation that gets there. The grid consumes it and strips it,
 * so a refresh does not flash the same note again.
 */
export const NOTE_TARGET_PARAM = "note";

export const stickyNotePath = (noteId: string) =>
  `${STICKY_NOTES_PATH}?${NOTE_TARGET_PARAM}=${encodeURIComponent(noteId)}`;
