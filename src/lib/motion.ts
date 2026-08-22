import type { Transition, Variants } from "motion/react";

/**
 * The app's motion vocabulary.
 *
 * Plain data, no React — so a server component can hand these to
 * `motion/react-client` and a client component to `motion/react`, and both get
 * the same movement. The point is that everything moves in the same way: one
 * curve in, one curve out, a handful of durations, one travel distance.
 * Animation that varies per surface reads as a page that cannot make its mind
 * up.
 *
 * The curve is the whole character. `[0.33, 1, 0.68, 1]` — cubic ease-out —
 * covers most of the distance early and then eases off over a long tail, so
 * movement registers straight away and comes to rest rather than stopping. It
 * is deliberately gentler than the expo curve this used to be: expo spends
 * almost everything in the first sixth of the duration, which at these lengths
 * reads as a snap followed by a drift.
 *
 * The durations are long enough to be *watched* rather than merely noticed —
 * roughly 450ms for the everyday case. That is the "settled, not performed"
 * line held from the other side: things arrive unhurried, and nothing is asked
 * to arrive twice as fast just because it is small.
 *
 * Anyone who has asked their system for less movement gets none of the
 * transforms — `MotionProvider` sets `reducedMotion="user"`, which keeps the
 * fades and drops the travel.
 */

/** Leaves promptly, lands softly. Cubic ease-out. Used by every entrance. */
export const EASE_OUT = [0.33, 1, 0.68, 1] as const;

/** For things that move both ways — a panel opening and closing, a reflow. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** Gathers pace as it goes. For things on their way out. */
export const EASE_IN = [0.32, 0, 0.67, 0] as const;

export const DURATION = {
  /** Hover, press, and anything tracking the pointer. */
  fast: 0.22,
  /** The default: entrances, fades, most state changes. */
  base: 0.45,
  /** Something large arriving — a page's first paint, a card. */
  slow: 0.7,
  /**
   * On the way out.
   *
   * Shorter than an entrance on purpose, and the one place brevity is right:
   * everything after a deletion — the gap closing, the rows below coming up —
   * is waiting on this, and a departure that took as long as an arrival would
   * make the whole list feel like it was thinking about it.
   */
  exit: 0.3,
} as const;

/** How far anything travels on its way in. */
export const TRAVEL = 10;

export const transition: Transition = {
  duration: DURATION.base,
  ease: EASE_OUT,
};

export const fastTransition: Transition = {
  duration: DURATION.fast,
  ease: EASE_OUT,
};

export const exitTransition: Transition = {
  duration: DURATION.exit,
  ease: EASE_IN,
};

/**
 * What a list does with the space a departing item leaves behind.
 *
 * A spring rather than a duration, because this one is not playing a clip —
 * it is closing a gap, and a gap that eases to a close the way a real thing
 * settles is the difference between rows shifting up and rows *sliding* up.
 * Just over critically damped: it arrives without a bounce, which on a list of
 * text would read as wobble.
 *
 * Handed to `layout` / `layoutTransition`, never to `animate`.
 */
export const layoutTransition: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 32,
  mass: 1,
};

/** Rises a little as it fades in. The workhorse. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: TRAVEL },
  visible: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, y: TRAVEL / 2, transition: exitTransition },
};

/** No travel — for things already in the right place, like a page header. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition },
  exit: { opacity: 0, transition: exitTransition },
};

/**
 * A list that deals its children in.
 *
 * `staggerChildren` is small on purpose: at 36ms a listing of twenty reads as
 * one movement with a grain to it, where at 100ms it reads as twenty things
 * queuing up, and the last row arrives long after the page looks ready.
 *
 * `delayChildren` covers the frame the container itself is settling in, so the
 * first child does not start before its parent has.
 */
export const listContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.036, delayChildren: 0.06 },
  },
};

/**
 * One row or card in a staggered list.
 *
 * The entrance has no `transition` of its own — the container's stagger
 * supplies the timing, and a child that named its own delay would fight it.
 * The exit does, because leaving is never staggered: an item is deleted on its
 * own, and it should go the moment it is gone rather than waiting its turn.
 *
 * Shrinking slightly as it fades is what makes a deletion read as *removal*
 * rather than as the list having quietly repainted. See the `AnimatePresence`
 * around each list — without one, none of this exit is ever played.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: TRAVEL },
  visible: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, scale: 0.96, transition: exitTransition },
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
  exit: { opacity: 0, scale: 0.97, transition: exitTransition },
};

/**
 * A block that opens in place of the row it belongs to — the todo editor, the
 * composer under a day.
 *
 * Barely moves and barely scales: it is replacing something that was already
 * there, at the same place in the list, so the movement's job is to say "this
 * is the same task, opened up" and not to announce a new panel. The list around
 * it is what actually has to give way, and that is `layout`'s job — see
 * `layoutTransition`.
 */
export const revealPanel: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition },
  exit: { opacity: 0, scale: 0.98, transition: exitTransition },
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

/**
 * Everything one item in a deletable list needs, in one spread.
 *
 * The entrance variants, the exit that `AnimatePresence` plays, and the
 * `layout` that makes the *other* items slide into the space rather than jump
 * into it. They travel together because a list where only some of the three
 * are wired is a list that deletes badly in one view and well in another —
 * which is exactly what was happening before this existed.
 *
 * `layout="position"` and not plain `layout`: the items are text, and a `layout`
 * that interpolated their width and height would stretch and squash the words
 * inside them while the box was in flight. Position alone means they slide.
 */
export const listItemMotion = {
  variants: listItem,
  initial: "hidden",
  animate: "visible",
  exit: "exit",
  layout: "position",
  transition: { layout: layoutTransition },
} as const;

/**
 * Everything `listItemMotion` has, except the arrival.
 *
 * For lists whose contents are *replaced* rather than added to. The drive is
 * the case this exists for: walking into a folder swaps every row at once, and
 * an entrance played per item turns an act of navigation into a wave of things
 * sliding into place — which reads as the page loading slowly rather than as a
 * folder having opened. The same animation on a list you have added one item to
 * is exactly right, which is why this is a second export and not a change to
 * the first.
 *
 * The exit and the layout stay. Deleting is still a thing that happens *to* a
 * list you are looking at, so an item still shrinks away and the ones below it
 * still slide up rather than jumping.
 */
export const listItemRemoval = {
  variants: listItem,
  exit: "exit",
  layout: "position",
  transition: { layout: layoutTransition },
} as const;

/**
 * The same, for anything inside an `AnimatePresence`.
 *
 * The `exit` is a variant *name*, which is the part that is easy to get wrong:
 * an element with `variants` and an inline `exit` object ignores half of what
 * it was given. Everything in this file that can leave defines an `exit` key,
 * so this spread is all a list item needs.
 */
export const presenceAnimation = {
  initial: "hidden",
  animate: "visible",
  exit: "exit",
} as const;
