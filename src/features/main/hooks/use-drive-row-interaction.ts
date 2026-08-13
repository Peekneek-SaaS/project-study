"use client";

import { useEffect, useRef } from "react";

import {
  type DriveItemKey,
  selectHasSelection,
  useDriveSelectionStore,
} from "@/lib/stores/drive-selection-store";

/** What a row hands back to the listing so it can work out the new selection. */
export interface RowSelectModifiers {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export type SelectRow = (
  modifiers: RowSelectModifiers,
  item: DriveItemKey,
) => void;

/** Long enough not to fire on a tap, short enough to feel like a press. */
const LONG_PRESS_MS = 400;
/** A press that wanders this far is a scroll, not a hold. */
const LONG_PRESS_TOLERANCE_PX = 10;

/** A tap, as opposed to a click — pointer info survives onto the click event. */
const isTouch = (event: React.MouseEvent) =>
  event.nativeEvent instanceof PointerEvent &&
  event.nativeEvent.pointerType === "touch";

interface DriveRowInteractionOptions {
  item: DriveItemKey;
  /** dnd-kit's flag for the row being carried right now. */
  isDragging: boolean;
  /** Open the folder, or the document. */
  onOpen: () => void;
  /** Selection, resolved against the listing's order — see `useDriveRowSelection`. */
  onSelect: SelectRow;
}

/**
 * Click behaviour for a drive row: click to select, double-click to open.
 *
 * The modifiers do what they do in a file manager — ⌘/ctrl adds one row, shift
 * takes everything between the anchor and here — and a selected row can still
 * be picked up and dragged, so the two gestures have to stay out of each
 * other's way. Touch has neither modifiers nor a double-tap worth trusting, so
 * it gets the phone convention instead: tap opens, hold selects.
 *
 * Shared by both row kinds so folders and documents cannot drift apart.
 */
export function useDriveRowInteraction({
  item,
  isDragging,
  onOpen,
  onSelect,
}: DriveRowInteractionOptions) {
  const toggle = useDriveSelectionStore((state) => state.toggle);
  const hasSelection = useDriveSelectionStore(selectHasSelection);

  // dnd-kit calls preventDefault on the click that ends a drag, which stops the
  // browser default but not React's handler — so track the gesture ourselves or
  // dropping a row somewhere would also select it.
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

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

  // Nothing should outlive the row — a listing is rebuilt on every refetch.
  useEffect(() => cancelLongPress, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    dragged.current = false;
    longPress.current.fired = false;
    cancelLongPress();

    if (event.pointerType !== "touch") return;

    longPress.current.origin = { x: event.clientX, y: event.clientY };
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.timer = null;
      longPress.current.fired = true;
      toggle(item);
      // Confirms the hold landed, on the phones that offer it.
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const { origin } = longPress.current;
    if (!origin) return;

    const travelled =
      Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y);
    if (travelled > LONG_PRESS_TOLERANCE_PX) cancelLongPress();
  };

  const handleClick = (event: React.MouseEvent) => {
    if (isDragging || dragged.current) return;

    if (isTouch(event)) {
      // The hold already did the work; the click it leaves behind is noise.
      if (longPress.current.fired) {
        longPress.current.fired = false;
        return;
      }
      // Tapping into a selection extends it rather than opening — the only way
      // to pick a second row without modifier keys.
      if (hasSelection) toggle(item);
      else onOpen();
      return;
    }

    onSelect(event, item);
  };

  return {
    tabIndex: 0,
    // Lets the keyboard move focus down the listing — see `useDriveRowSelection`.
    "data-drive-row": `${item.kind}:${item.id}`,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: cancelLongPress,
    onPointerCancel: cancelLongPress,
    onClick: handleClick,
    onDoubleClick: (event: React.MouseEvent) => {
      if (dragged.current) return;
      // The first click of the pair already selected the row; opening on top of
      // that is exactly what a file manager does.
      event.preventDefault();
      onOpen();
    },
    onContextMenu: (event: React.MouseEvent) => {
      // Android raises this at the end of a hold. Right-click on a desktop is
      // left alone.
      if (isTouch(event) || longPress.current.fired) event.preventDefault();
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      // Rows carry buttons, so only act on the row's own keystrokes.
      if (event.target !== event.currentTarget) return;

      if (event.key === "Enter") {
        event.preventDefault();
        onOpen();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        toggle(item);
      }
    },
  };
}
