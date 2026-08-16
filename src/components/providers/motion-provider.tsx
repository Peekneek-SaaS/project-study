"use client";

import { MotionConfig } from "motion/react";

import { transition } from "@/lib/motion";

/**
 * Motion's global settings.
 *
 * A client component of its own rather than something the root layout does,
 * because `MotionConfig` is not among the pieces `motion/react-client` exports
 * — that entry carries the DOM elements and nothing else. Rendered by the
 * server layout the same way the theme and query providers already are, so no
 * server component has to become a client one to get it.
 *
 * `reducedMotion="user"` is the part that matters most. It reads the operating
 * system's setting and, for anyone who has asked for less movement, drops the
 * transforms while keeping the opacity — so the interface still explains itself
 * with fades instead of either lurching or going completely static.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={transition}>
      {children}
    </MotionConfig>
  );
}
