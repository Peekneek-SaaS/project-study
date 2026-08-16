"use client";

import { motion } from "motion/react";

import { TableBody, TableRow } from "@/components/ui/table";

/**
 * The table pieces, animatable.
 *
 * `motion.create` wraps the existing components rather than swapping in a bare
 * `motion.tbody` / `motion.tr`, so the styling, the `data-slot` hooks and the
 * row's hover and selected states all carry over untouched — the only thing
 * added is the ability to take `variants`.
 *
 * Made once at module scope, never inside a render: `motion.create` builds a
 * new component type each time it is called, and a new type on every render is
 * a subtree React throws away and rebuilds — which would restart the animation
 * it was there to run.
 */
export const MotionTableBody = motion.create(TableBody);
export const MotionTableRow = motion.create(TableRow);
