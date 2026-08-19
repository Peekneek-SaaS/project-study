import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * A todo as the page renders it.
 *
 * Every timestamp on it is a string, and deliberately so — see the router,
 * which converts them on the way out. There is no transformer configured on
 * this tRPC instance, so a `Date` in a procedure's return type is a lie the
 * client discovers at runtime; typing them as what actually arrives means
 * nothing downstream has to remember that.
 */
export type Todo = RouterOutputs["todo"]["list"][number];

/** A day's worth of counts, for the dots in the header's calendar. */
export type TodoDayCount = RouterOutputs["todo"]["calendar"][number];

export const TODO_PATH = "/todo";

/**
 * The todo page, pointed at one day.
 *
 * A query parameter rather than a store, because the thing asking is on another
 * page — the calendar in the header — and a parameter survives the navigation
 * that gets there. The page consumes it and strips it, so a refresh does not
 * jump away from wherever the reader has since scrolled.
 *
 * Deliberately separate from the filter params: this is a one-shot instruction,
 * those are state meant to stick around. The same split as the notes wall's
 * `NOTE_TARGET_PARAM`.
 */
export const TODO_DATE_PARAM = "date";

export const todoDatePath = (day: string) =>
  `${TODO_PATH}?${TODO_DATE_PARAM}=${encodeURIComponent(day)}`;
