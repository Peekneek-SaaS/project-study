import type { PipCorner } from "@/features/work/types";

/**
 * Where the floating document sits, and which way it grows.
 *
 * Kept apart from the component because it is all arithmetic and no React: the
 * window is anchored to a corner rather than positioned absolutely, and every
 * consequence of that — which edges are free, which way a drag on the grip
 * means "bigger" — follows from the corner alone.
 */

/** How far the window is held off the edges it is parked against. */
export const PIP_INSET = 16;

export const PIP_MIN_WIDTH = 240;
export const PIP_MIN_HEIGHT = 180;

/** What it opens at, before anyone has resized it. */
export const PIP_DEFAULT_WIDTH = 380;
export const PIP_DEFAULT_HEIGHT = 460;

const isRight = (corner: PipCorner) => corner.endsWith("right");
const isBottom = (corner: PipCorner) => corner.startsWith("bottom");

/**
 * The two offsets that pin the window to its corner.
 *
 * Only ever two of the four — anchoring `top` *and* `bottom` would stretch the
 * window to the container instead of placing it, which is why the size below is
 * applied as a width and height rather than as the remaining two offsets.
 */
export function cornerOffsets(corner: PipCorner) {
  return {
    ...(isBottom(corner) ? { bottom: PIP_INSET } : { top: PIP_INSET }),
    ...(isRight(corner) ? { right: PIP_INSET } : { left: PIP_INSET }),
  };
}

/**
 * Which corner a window centred at this point belongs in.
 *
 * Halves rather than nearest-distance: the two give the same answer for a
 * rectangular container, and halves keep it obvious that every point on screen
 * maps to exactly one corner with no gap between them.
 */
export function nearestCorner(
  centerX: number,
  centerY: number,
  bounds: { width: number; height: number },
): PipCorner {
  const vertical = centerY < bounds.height / 2 ? "top" : "bottom";
  const horizontal = centerX < bounds.width / 2 ? "left" : "right";
  return `${vertical}-${horizontal}` as PipCorner;
}

/**
 * Where the resize grip goes, and what a drag on it means.
 *
 * The grip belongs on the corner facing *into* the container, because that is
 * the only one whose edges are free to move: the other two run along edges the
 * window is anchored to, where dragging could only move the window rather than
 * resize it.
 *
 * The signs follow from the same fact. Parked bottom-right, the window grows as
 * the pointer travels up and to the left, so both deltas are negated.
 */
export function resizeGrip(corner: PipCorner) {
  return {
    /** Tailwind-friendly placement of the grip within the window. */
    position: {
      vertical: isBottom(corner) ? ("top" as const) : ("bottom" as const),
      horizontal: isRight(corner) ? ("left" as const) : ("right" as const),
    },
    signX: isRight(corner) ? -1 : 1,
    signY: isBottom(corner) ? -1 : 1,
  };
}

/** Keeps a resize within both its own minimum and the room available. */
export function clampSize(
  size: { width: number; height: number },
  bounds: { width: number; height: number },
) {
  // The inset is subtracted twice over: once for the edge the window is parked
  // against, once so a window grown to full size still clears the far edge.
  const maxWidth = Math.max(PIP_MIN_WIDTH, bounds.width - PIP_INSET * 2);
  const maxHeight = Math.max(PIP_MIN_HEIGHT, bounds.height - PIP_INSET * 2);

  return {
    width: Math.min(maxWidth, Math.max(PIP_MIN_WIDTH, size.width)),
    height: Math.min(maxHeight, Math.max(PIP_MIN_HEIGHT, size.height)),
  };
}
