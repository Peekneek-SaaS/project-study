import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * A board as the table sees it — everything but the scene.
 *
 * Reached through `items` because the list is paged: the procedure returns one
 * page and the cursor after it, and this is a row inside that page.
 */
export type BoardListItem = RouterOutputs["board"]["list"]["items"][number];

/** A board with its scene, as the canvas opens it. */
export type BoardWithSnapshot = RouterOutputs["board"]["get"];

/** The listing every board is opened from, and the way back out of one. */
export const BOARDS_PATH = "/board";

/** Where a board lives. Boards are pages, not modals — each one has a URL. */
export const boardPath = (boardId: string) => `${BOARDS_PATH}/${boardId}`;
