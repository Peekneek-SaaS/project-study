"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";

import { DURATION, EASE_IN_OUT } from "@/lib/motion";

/**
 * The strip above the nav.
 *
 * Collapses its own height on dismissal rather than just fading, so the page
 * comes up to meet the top of the window instead of leaving a black gap where
 * the bar used to be. `AnimatePresence` is what lets the height run down to
 * zero on the way out — without it the element is gone on the frame it is
 * unmounted and the nav jumps.
 *
 * Not persisted. It costs a round trip to a store to remember a dismissal that
 * matters for one scroll, and a first-time visitor is the only person this bar
 * is written for.
 */
export function AnnouncementBar() {
  const [open, setOpen] = useState(true);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
          exit={{ height: 0 }}
          transition={{ duration: DURATION.exit, ease: EASE_IN_OUT }}
          className="overflow-hidden bg-[oklch(0.16_0.004_106.75)]"
        >
          <div className="relative flex h-10 items-center justify-center px-10">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-[oklch(1_0_0_/_0.82)] transition-colors hover:text-[oklch(0.99_0_0)]"
            >
              <span className="shrink-0 rounded-none bg-primary px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase text-primary-foreground">
                New
              </span>
              {/*
                Two lengths of the same sentence rather than one that wraps.
                The bar is a fixed 40px — a headline that runs to two lines on a
                narrow phone pushes its own descenders out of the strip, and
                letting the bar grow instead would shove the whole page down on
                exactly the devices with the least room to give.
              */}
              <span className="hidden sm:inline">
                Ask one question across every document you have uploaded
              </span>
              <span className="sm:hidden">Ask across every document</span>
              <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Dismiss announcement"
              className="absolute right-3 grid size-6 place-items-center rounded-none text-[oklch(1_0_0_/_0.45)] transition-colors hover:bg-[oklch(1_0_0_/_0.08)] hover:text-[oklch(0.99_0_0)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
