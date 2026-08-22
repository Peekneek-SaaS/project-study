"use client";

import * as React from "react";

/**
 * Whether this device can point at something without pressing it.
 *
 * `(hover: hover) and (pointer: fine)` is the pair that means "a mouse or a
 * trackpad", and it is the honest question to ask before hanging anything on
 * hover — a narrow window on a laptop is still a mouse, and a large tablet is
 * still a finger, so a width breakpoint answers a different question than the
 * one being asked. See `useIsMobile` for the times width really is the point.
 *
 * Starts as `true` and corrects on mount, so the server and the first client
 * render agree. A touch device therefore spends one frame believing it can
 * hover, which costs nothing: the correction lands long before anything is
 * pointed at.
 */
export function useHasHover() {
  const [hasHover, setHasHover] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = () => setHasHover(query.matches);

    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return hasHover;
}
