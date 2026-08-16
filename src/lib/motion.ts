import type { Transition, Variants } from "motion/react";

/**
 * The app's motion vocabulary.
 *
 * Plain data, no React — so a server component can hand these to
 * `motion/react-client` and a client component to `motion/react`, and both get
 * the same movement. The point is that everything moves in the same way: one
 * curve, three durations, one travel distance. Animation that varies per
 * surface reads as a page that cannot make its mind up.
 *
 * The curve is the whole character. `[0.22, 1, 0.36, 1]` leaves fast and lands
 * slowly — most of the distance is covered in the first third, so the movement
 * registers immediately and then settles rather than sliding to a stop. That is
 * what makes it feel smooth instead of slow.
 *
 * Everything here is deliberately small. 8px of travel and 200ms of fade is
 * under the threshold where movement becomes something you wait for; the aim is
 * for the page to feel like it settled, not like it performed.
 */

/** Leaves quickly, lands softly. Used by every entrance. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** For things that move both ways — a panel opening and closing. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  /** Hover, press, and anything tracking the pointer. */
  fast: 0.18,
  /** The default: entrances, fades, most state changes. */
  base: 0.32,
  /** Something large arriving — a page's first paint. */
  slow: 0.5,
} as const;

/** How far anything travels on its way in. Small on purpose. */
export const TRAVEL = 8;

export const transition: Transition = {
  duration: DURATION.base,
  ease: EASE_OUT,
};

export const fastTransition: Transition = {
  duration: DURATION.fast,
  ease: EASE_OUT,
};

/** Rises a little as it fades in. The workhorse. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: TRAVEL },
  visible: { opacity: 1, y: 0, transition },
};

/** No travel — for things already in the right place, like a page header. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition },
};

/**
 * A list that deals its children in.
 *
 * `staggerChildren` is small on purpose: at 24ms a listing of twenty reads as
 * one movement with a grain to it, where at 80ms it reads as twenty things
 * queuing up, and the last row arrives long after the page looks ready.
 *
 * `delayChildren` covers the frame the container itself is settling in, so the
 * first child does not start before its parent has.
 */
export const listContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.024, delayChildren: 0.04 },
  },
};

/**
 * One row or card in a staggered list.
 *
 * No `transition` of its own — the container's stagger supplies the timing, and
 * a child that named its own delay would fight it.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: TRAVEL },
  visible: { opacity: 1, y: 0, transition },
};

/** Arrives from slightly under-size. For cards and empty states. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: TRAVEL },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE_OUT },
  },
};

/**
 * The pair every animated-on-mount element needs.
 *
 * Spread rather than written out each time, so nothing ends up half-wired —
 * `variants` with no `animate` is a component that stays hidden.
 */
export const mountAnimation = {
  initial: "hidden",
  animate: "visible",
} as const;
