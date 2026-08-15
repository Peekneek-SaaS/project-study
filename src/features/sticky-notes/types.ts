import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** A note as the grid renders it. */
export type StickyNote = RouterOutputs["stickyNote"]["list"][number];
