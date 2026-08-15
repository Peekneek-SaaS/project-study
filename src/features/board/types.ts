import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** A board as the table sees it — everything but the scene. */
export type BoardListItem = RouterOutputs["board"]["list"][number];

/** A board with its scene, as the canvas opens it. */
export type BoardWithSnapshot = RouterOutputs["board"]["get"];

/** Where a board lives. Boards are pages, not modals — each one has a URL. */
export const boardPath = (boardId: string) => `/board/${boardId}`;
