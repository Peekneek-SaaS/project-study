import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

type StoredAnnotation =
  RouterOutputs["annotation"]["listForDocument"][number];

/**
 * One annotation, with its `rects` column flattened to `unknown`.
 *
 * Prisma types a Json column as `JsonValue`, which is recursive — an array of
 * values, each of which may be an object of values, and so on without bound.
 * Carried through `map`, `sort` and `Set`, TypeScript tries to expand it at
 * every step and gives up with "type instantiation is excessively deep".
 *
 * Narrowing it here rather than at each call site keeps the noise in one place,
 * and costs nothing real: nothing is allowed to trust the column's shape
 * anyway. It is parsed and validated on the way out by `anchorRectsOf`, which
 * is the one reader, and which already had to handle rows written before the
 * column existed.
 */
export type Annotation = Omit<StoredAnnotation, "rects"> & {
  rects: unknown;
};

/**
 * How tall the read-only popover is allowed to grow before it gives up and
 * offers the modal instead.
 *
 * A number rather than a `max-h-*` class because the "see more" button has to
 * know the same figure: it appears exactly when the content was clipped, and a
 * class the JavaScript cannot read would mean measuring against one limit and
 * clipping at another.
 */
export const POPOVER_BODY_MAX_HEIGHT = 168;

/** The popover's width. Fixed, so a one-line note and a long one match. */
export const POPOVER_WIDTH = 280;
