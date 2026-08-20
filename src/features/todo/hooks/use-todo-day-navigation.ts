"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { TodoViewType } from "@/lib/stores/todo-view-store";
import { todayKey } from "@/features/todo/lib/todo-dates";
import { TODO_DATE_PARAM, TODO_PATH } from "@/features/todo/types";

/** Long enough to find the day, short enough not to nag. */
const FLASH_MS = 3000;

/**
 * How long the landing keeps correcting itself, in ms.
 *
 * Long enough to outlast everything that moves the page just after it appears —
 * see the layout effect below — and short enough that a reader could not have
 * meant to scroll within it. Any real interaction stops it early regardless.
 */
const ANCHOR_SETTLE_MS = 400;

/** What counts as the reader taking over. */
const TAKEOVER_EVENTS = [
  "wheel",
  "touchstart",
  "pointerdown",
  "keydown",
] as const;

/** The attribute a day section marks itself with, for both scroll and flash. */
export const DAY_ATTRIBUTE = "data-todo-day";

function scrollToDay(day: string, behavior: ScrollBehavior, view: TodoViewType) {
  const element = document.querySelector(`[${DAY_ATTRIBUTE}="${day}"]`);
  if (!element) return false;

  element.scrollIntoView({
    behavior,
    // In the grid the days run across, so the horizontal axis is the one that
    // matters and `nearest` keeps the page from scrolling vertically for it.
    block: view === "grid" ? "nearest" : "start",
    inline: view === "grid" ? "start" : "nearest",
  });

  return true;
}

/**
 * Keeps trying a scroll until it has taken, then stops.
 *
 * Both journeys on this page need this, for two different reasons. The landing
 * on today needs its position *held*, because the router, a restored offset and
 * the rows staggering in all move the page just after it — see the layout
 * effect. A day arrived at by name needs its section to *exist*, which can be a
 * commit later than the effect that asks for it.
 *
 * `hold` is what separates them. Without it the loop ends the moment the scroll
 * lands, which is what a smooth one requires: re-asserting an animation every
 * frame restarts it every frame, and the page would creep towards the day
 * forever instead of travelling there.
 *
 * Any sign of the reader taking over ends it immediately. Four hundred
 * milliseconds is far too short a window to scroll in on purpose, but a landing
 * that fought the reader even once would be worse than one that missed.
 */
function keepScrolling(
  scroll: () => boolean,
  { hold, onEnd }: { hold: boolean; onEnd?: () => void },
) {
  let frame = 0;
  let stopped = false;
  const deadline = performance.now() + ANCHOR_SETTLE_MS;

  const stop = () => {
    stopped = true;
  };

  for (const type of TAKEOVER_EVENTS) {
    window.addEventListener(type, stop, { passive: true });
  }

  const release = () => {
    window.cancelAnimationFrame(frame);
    for (const type of TAKEOVER_EVENTS) {
      window.removeEventListener(type, stop);
    }
  };

  const settle = () => {
    if (stopped || performance.now() > deadline) {
      release();
      onEnd?.();
      return;
    }

    const landed = scroll();

    if (landed && !hold) {
      release();
      onEnd?.();
      return;
    }

    frame = window.requestAnimationFrame(settle);
  };

  frame = window.requestAnimationFrame(settle);

  return release;
}

/**
 * Puts the reader where they meant to be: on today, or on the day something
 * pointed them at.
 *
 * Arriving on this page always lands on today, never at the top. The page is
 * ordered future-first — scrolling *up* walks forward through the week — so the
 * top of it is a fortnight away, and a reader dropped there would have to
 * scroll to find the day they came for. Today is the anchor; the rest is
 * context above and below it.
 *
 * That first scroll is a layout effect and deliberately not smooth: it is not a
 * movement anybody should see, it is where the page starts, and doing it before
 * paint means the fortnight-away view never flashes past. A day arrived at from
 * the header's calendar while already here *is* a movement, so that one
 * animates.
 */
export function useTodoDayNavigation(view: TodoViewType) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const targetDay = searchParams.get(TODO_DATE_PARAM);

  const [flashingDay, setFlashingDay] = useState<string | null>(null);

  // Which view the page has already been parked in. Also the "have we ever
  // anchored" flag — null means this is the first paint, which is what decides
  // between an instant landing and a visible scroll.
  const anchoredView = useRef<TodoViewType | null>(null);
  // The target already consumed, so stripping it from the URL — which
  // re-renders this hook with no target at all — does not look like a fresh
  // arrival and send the page back to today.
  const handledTarget = useRef<string | null>(null);

  useLayoutEffect(() => {
    // A named day supersedes the default anchor, and the effect below scrolls
    // to it. Two effects racing for the scroll position would be visible.
    if (targetDay) return;
    if (anchoredView.current === view) return;

    // Switching between the list and the grid rebuilds the days along the other
    // axis, where the old scroll position means nothing — so a view change
    // re-anchors, exactly as arriving does.
    // Not conditional on the first attempt landing: a navigation can commit
    // this effect a frame before the day sections are actually in the document,
    // and giving up there is what would leave the page at the top for good. The
    // loop below keeps trying for as long as it keeps trying anything.
    const anchor = () => {
      if (!scrollToDay(todayKey(), "instant", view)) return false;
      anchoredView.current = view;
      return true;
    };

    anchor();

    /*
      And then held there for a few frames, which is the part that makes
      arriving here actually land on today.

      One scroll during the commit is not enough, because three other things
      move the page just after it: the router puts a client navigation back at
      the top of the document, the browser restores the old offset on a reload,
      and the rows fade and stagger in, which changes the height of everything
      above today while it settles. Whichever lands last wins, and it was never
      this — hence a page that opened a fortnight away however right the anchor
      was.

      So the anchor is simply re-asserted until the page stops moving under it.
      Instant, and always the same target, so there is nothing to watch: every
      call after the first is a no-op unless something has displaced it.
    */
    return keepScrolling(anchor, { hold: true });
  }, [targetDay, view]);

  useEffect(() => {
    if (!targetDay) {
      // Cleared so that picking the *same* day again later is a fresh journey
      // rather than one this hook thinks it has already made.
      handledTarget.current = null;
      return;
    }

    if (handledTarget.current === targetDay) return;
    handledTarget.current = targetDay;

    const first = anchoredView.current === null;
    // Claimed before the frame runs, so the layout effect above does not treat
    // the re-render that clears the parameter as an unanchored arrival.
    anchoredView.current = view;

    // Arriving from another page starts at the top of a fortnight of days;
    // animating all the way down from there is a long scroll nobody asked to
    // watch. Moving between days while already here is worth seeing.
    const behavior: ScrollBehavior = first ? "instant" : "smooth";

    // Held for the settle window only when the landing is instant. An arrival
    // has the router, the restored offset and the staggering rows to survive,
    // exactly as the anchor above does; a smooth scroll on a page that is
    // already still has nothing to fight, and re-asserting one would only
    // restart it.
    return keepScrolling(
      () => {
        if (!scrollToDay(targetDay, behavior, view)) return false;
        // Set on landing rather than on asking, so the highlight and the
        // journey cannot come apart — a day that took a few frames to appear
        // would otherwise have spent some of its three seconds off screen.
        setFlashingDay(targetDay);
        return true;
      },
      {
        hold: first,
        // Cleared once the scrolling is over rather than alongside it.
        // Stripping the parameter re-renders this hook with no target, which
        // runs this effect's cleanup — so doing it any earlier would cancel the
        // very loop that had not finished yet. That is also why the day is
        // pinned into the window by `useTodosBrowser` and not read from here:
        // the section has to outlive the parameter that asked for it.
        //
        // Only this parameter rather than the whole query string: the filters
        // live there too, and following the calendar to a day should not take
        // them down with it.
        onEnd: () => {
          const rest = new URLSearchParams(searchParams);
          rest.delete(TODO_DATE_PARAM);
          const query = rest.toString();
          const path = pathname || TODO_PATH;

          router.replace(query ? `${path}?${query}` : path, { scroll: false });
        },
      },
    );
  }, [pathname, router, searchParams, targetDay, view]);

  // Kept apart from the effect above so the countdown is not restarted by the
  // re-render that clearing the parameter causes.
  useEffect(() => {
    if (!flashingDay) return;

    const timer = window.setTimeout(() => setFlashingDay(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashingDay]);

  return flashingDay;
}
