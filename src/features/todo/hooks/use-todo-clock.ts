"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * The second hand, for as long as something is counting.
 *
 * A subscription rather than a `setInterval` in an effect writing to state,
 * because that is what this is: the clock is an external system, and
 * `useSyncExternalStore` is the shape for reading one. The snapshot is held in
 * a ref and only replaced on a tick — returning `Date.now()` from `getSnapshot`
 * would hand React a new value every time it looked and re-render forever.
 *
 * The server snapshot is `null`, and so is the client's until the first tick.
 * That is deliberate: a real instant during render would differ between the
 * server pass and the hydrating pass and mismatch the markup. `readTimer`
 * understands the `null` and reads a running timer as though its current
 * stretch has not begun, so the first paint is close and the first tick makes
 * it exact.
 *
 * `active` is false whenever nothing on screen is running, and the interval is
 * never created — a page of finished todos should not be waking up once a
 * second forever.
 */
export function useTodoClock(active: boolean): number | null {
  const now = useRef<number | null>(null);

  const subscribe = useCallback(
    (onTick: () => void) => {
      if (!active) return () => {};

      // Set immediately as well as on the interval: waiting a whole second for
      // the first tick is a second of the countdown visibly not moving.
      now.current = Date.now();
      onTick();

      const id = window.setInterval(() => {
        now.current = Date.now();
        onTick();
      }, 1000);

      return () => window.clearInterval(id);
    },
    [active],
  );

  // Reads `null` while inactive without having to clear the ref, so a paused
  // timer is not left showing the instant it happened to stop at.
  const getSnapshot = useCallback(() => (active ? now.current : null), [active]);
  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
