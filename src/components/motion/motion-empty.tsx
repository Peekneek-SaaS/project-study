"use client";

import { motion } from "motion/react";

import { Empty } from "@/components/ui/empty";

/**
 * The empty state, animatable.
 *
 * Wrapped rather than given an extra `motion.div` around it, because `Empty`
 * carries the `flex-1` that lets it centre itself in whatever height the page
 * has left — a wrapper in between would take that height and leave the state
 * sitting at the top of it.
 *
 * Made once at module scope: `motion.create` builds a new component type per
 * call, and a new type each render is a subtree React discards and rebuilds.
 */
export const MotionEmpty = motion.create(Empty);
