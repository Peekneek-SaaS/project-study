"use client";

import { useEffect, useRef } from "react";

import {
  TOUCH_HOLD_MS,
  TOUCH_HOLD_TOLERANCE_PX,
} from "@/features/main/lib/drive-sensors";

/** Marks a row so the keyboard and the background click can find it again. */
export const ROW_ATTRIBUTE = "data-row-key";

/** What a row hands back to the list so it can work out the new selection. */
export interface RowSelectModifiers {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

interface RowInteractionOptions {
  /** Identifies the row in the DOM, for `focusRow` and for hit-testing. */
  rowKey: string;
  /** dnd-kit's flag for the row being carried right now, where there is one. */
  isDragging?: boolean;
  /** Whether the list has anything ticked — decides what a bare tap does. */
  hasSelection: boolean;
  /** Add or remove this row, leaving the rest. */
  onToggle: () => void;
  /** Open whatever the row stands for. */
  onOpen: () => void;
  /** Selection, resolved against the list's order — see `useRowSelection`. */
  onSelect: (modifiers: RowSelectModifiers) => void;
}

/**
 * Click behaviour for a row in a list: click to select, double-click to open.
 *
 * The modifiers do what they do in a file manager — ⌘/ctrl adds one row, shift
 * takes everything between the anchor and here — and a selected row can still
 * be picked up and dragged, so the two gestures have to stay out of each
 * other's way. Touch has neither modifiers nor a double-tap worth trusting, so
 * it gets the phone convention instead: tap opens, hold selects, and once a
 * hold has opened a selection every further tap adds to it, until the last tick
 * comes off and taps go back to opening. Carrying on from the hold drags, which
 * belongs to the sensor rather than to this hook — see `driveSensors`, which
 * arms the drag on the same hold this one ticks the row with.
 *
 * Kept free of any one list's shape — it is handed callbacks rather than a
 * store — so the drive and the boards cannot drift apart on the gesture that
 * both of them are judged by.
 */
export function useRowInteraction({
  rowKey,
  isDragging = false,
  hasSelection,
  onToggle,
  onOpen,
  onSelect,
}: RowInteractionOptions) {
  // dnd-kit calls preventDefault on the click that ends a drag, which stops the
  // browser default but not React's handler — so track the gesture ourselves or
  // dropping a row somewhere would also select it.
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  // Which kind of pointer opened the gesture, read where it is trustworthy.
  // Browsers disagree about the click a tap leaves behind — WebKit hands back
  // an empty `pointerType`, and a click synthesised from touch can claim to be
  // a mouse — so asking the click itself would make a phone look like a
  // desktop, and the touch branch below would never run.
  const pointerType = useRef<string>("mouse");

  // The hold that selects, and the click it has to swallow afterwards.
  const longPress = useRef<{
    timer: number | null;
    origin: { x: number; y: number } | null;
    fired: boolean;
  }>({ timer: null, origin: null, fired: false });

  const cancelLongPress = () => {
    if (longPress.current.timer !== null) {
      window.clearTimeout(longPress.current.timer);
      longPress.current.timer = null;
    }
    longPress.current.origin = null;
  };

  // Nothing should outlive the row — a list is rebuilt on every refetch.
  useEffect(() => cancelLongPress, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    dragged.current = false;
    longPress.current.fired = false;
    pointerType.current = event.pointerType;
    cancelLongPress();

    if (event.pointerType !== "touch") return;

    longPress.current.origin = { x: event.clientX, y: event.clientY };
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.timer = null;
      longPress.current.fired = true;
      onToggle();
      // Confirms the hold landed, on the phones that offer it. The row lifting
      // under the finger — the sensor's doing, on the same timer — says it
      // everywhere else.
      navigator.vibrate?.(10);
    }, TOUCH_HOLD_MS);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const { origin } = longPress.current;
    if (!origin) return;

    // Straight-line, matching how the sensor measures its own tolerance, so a
    // drift that costs the drag costs the tick as well.
    const travelled = Math.hypot(
      event.clientX - origin.x,
      event.clientY - origin.y,
    );
    if (travelled > TOUCH_HOLD_TOLERANCE_PX) cancelLongPress();
  };

  const handleClick = (event: React.MouseEvent) => {
    if (isDragging || dragged.current) return;

    if (pointerType.current === "touch") {
      // The hold already did the work; the click it leaves behind is noise.
      if (longPress.current.fired) {
        longPress.current.fired = false;
        return;
      }
      // A selection is already open, so this tap joins it rather than opening
      // the row — the only way to pick a second one without modifier keys, and
      // what a phone's file manager does once a hold has put it into selection
      // mode. Untick the last row and the next tap opens again.
      if (hasSelection) onToggle();
      else onOpen();
      return;
    }

    onSelect(event);
  };

  return {
    tabIndex: 0,
    // Lets the keyboard move focus down the list — see `useRowSelection`.
    [ROW_ATTRIBUTE]: rowKey,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: cancelLongPress,
    onPointerCancel: cancelLongPress,
    onClick: handleClick,
    onDoubleClick: (event: React.MouseEvent) => {
      // Two quick taps are two taps on a phone — a row ticked and unticked —
      // not the desktop gesture for opening, which is why touch stops here.
      if (dragged.current || pointerType.current === "touch") return;
      // The first click of the pair already selected the row; opening on top of
      // that is exactly what a file manager does.
      event.preventDefault();
      onOpen();
    },
    onContextMenu: (event: React.MouseEvent) => {
      // Android raises this at the end of a hold. Right-click on a desktop is
      // left alone.
      if (pointerType.current === "touch" || longPress.current.fired)
        event.preventDefault();
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      // Rows carry buttons, so only act on the row's own keystrokes.
      if (event.target !== event.currentTarget) return;

      // Enter opens. Space is left to the browser, which scrolls with it.
      if (event.key !== "Enter") return;
      event.preventDefault();
      onOpen();
    },
  };
}

/** Follows the selection with the browser's focus, so Enter has something to act on. */
export function focusRow(rowKey: string) {
  const row = document.querySelector<HTMLElement>(
    `[${ROW_ATTRIBUTE}="${rowKey}"]`,
  );
  row?.focus({ preventScroll: true });
  row?.scrollIntoView({ block: "nearest" });
}
