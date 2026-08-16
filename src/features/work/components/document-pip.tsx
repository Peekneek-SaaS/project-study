"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkDocumentPanel } from "@/features/work/components/work-document-panel";
import {
  clampSize,
  cornerOffsets,
  nearestCorner,
  PIP_DEFAULT_HEIGHT,
  PIP_DEFAULT_WIDTH,
  resizeGrip,
} from "@/features/work/lib/pip-geometry";
import type { PipCorner } from "@/features/work/types";
import { cn } from "@/lib/utils";

/** What a drag has to travel before it counts as one rather than as a click. */
const DRAG_THRESHOLD = 4;

/**
 * The minimised document, floating over the sections.
 *
 * Parked in a corner rather than left wherever it was dropped: see `PipCorner`
 * for why. A drag moves it freely while the pointer is down and snaps to
 * whichever corner it was let go nearest, so it never ends up half off the
 * edge, and a resized window never leaves it stranded outside the container.
 *
 * Pointer events throughout rather than mouse or touch: one set of handlers
 * covers a trackpad, a finger and a stylus, and pointer capture means a fast
 * drag that outruns the element still delivers its moves here instead of
 * dropping the window wherever the pointer left it.
 */
export function DocumentPip({
  documentId,
  name,
  corner,
  onCornerChange,
  onRestore,
}: {
  documentId: string;
  name: string;
  corner: PipCorner;
  onCornerChange: (corner: PipCorner) => void;
  onRestore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({
    width: PIP_DEFAULT_WIDTH,
    height: PIP_DEFAULT_HEIGHT,
  });
  // Where the window is relative to its parked corner, mid-drag. Zero at rest —
  // the corner offsets are what place it, and this is only the deviation.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const grip = resizeGrip(corner);

  // A window sized while the panel was wide can be too big for it once the
  // panel narrows, which would leave it hanging over an edge with its grip off
  // screen. Re-clamped whenever the container changes rather than only on
  // resize, so it is corrected before it is ever drawn wrong.
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize((current) => clampSize(current, entry.contentRect));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleDragPointerDown = (event: React.PointerEvent) => {
    // Left button or a touch. A right-click on the bar should reach the context
    // menu rather than start dragging the window.
    if (event.button !== 0) return;

    const container = ref.current?.parentElement;
    const element = ref.current;
    if (!container || !element) return;

    event.preventDefault();

    // Captured now, while the event is still being dispatched. React nulls
    // `currentTarget` once the handler returns, so the listeners below — which
    // run later — would find nothing to detach themselves from.
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const handleMove = (move: PointerEvent) => {
      const dx = move.clientX - startX;
      const dy = move.clientY - startY;

      // Below the threshold this is still a click as far as anything else is
      // concerned, so nothing moves and no drag state is entered.
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      setIsDragging(true);
      setOffset({ x: dx, y: dy });
    };

    const handleUp = () => {
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleUp);
      handle.removeEventListener("pointercancel", handleUp);

      setIsDragging(false);
      setOffset({ x: 0, y: 0 });
      if (!moved) return;

      // Measured off the element rather than computed from the offset: the box
      // already accounts for the corner it started in and the size it is, both
      // of which reconstructing from the anchor would have to redo.
      const box = element.getBoundingClientRect();
      const bounds = container.getBoundingClientRect();

      onCornerChange(
        nearestCorner(
          box.left + box.width / 2 - bounds.left,
          box.top + box.height / 2 - bounds.top,
          bounds,
        ),
      );
    };

    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleUp);
    handle.addEventListener("pointercancel", handleUp);
  };

  const handleResizePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;

    const container = ref.current?.parentElement;
    if (!container) return;

    event.preventDefault();
    // The grip sits inside the window but not on its bar, so this is belt and
    // braces rather than strictly needed — it keeps a grip that ever moves onto
    // the bar from starting a drag and a resize at once.
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = size;

    const handleMove = (move: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      setSize(
        clampSize(
          {
            width: startSize.width + (move.clientX - startX) * grip.signX,
            height: startSize.height + (move.clientY - startY) * grip.signY,
          },
          bounds,
        ),
      );
    };

    const handleUp = () => {
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleUp);
      handle.removeEventListener("pointercancel", handleUp);
    };

    handle.addEventListener("pointermove", handleMove);
    handle.addEventListener("pointerup", handleUp);
    handle.addEventListener("pointercancel", handleUp);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-40 flex flex-col overflow-hidden rounded-lg border bg-card shadow-2xl",
        // Snapping back to a corner is worth watching; following a pointer is
        // not — a transition on a live drag would run a frame behind the finger.
        !isDragging && "transition-[top,right,bottom,left] duration-200 ease-out",
      )}
      style={{
        ...cornerOffsets(corner),
        width: size.width,
        height: size.height,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      {/*
        The bar is the drag handle, so the whole top edge is grabbable rather
        than just the grip icon. `touch-none` stops a finger drag from scrolling
        the panel underneath at the same time.
      */}
      <div
        onPointerDown={handleDragPointerDown}
        className={cn(
          "flex h-7 shrink-0 touch-none items-center gap-1 border-b bg-muted/40 pl-1",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground" title={name}>
          {name}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto mr-1"
          aria-label="Restore the document panel"
          // The bar swallows pointer events to drag; without this the button
          // would start a drag instead of being pressed.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRestore}
        >
          <Maximize2 />
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <WorkDocumentPanel documentId={documentId} name={name} compact />
      </div>

      {/*
        One grip, on the corner facing into the container — the only corner
        whose edges are free to move. See `resizeGrip`.
      */}
      <div
        onPointerDown={handleResizePointerDown}
        role="separator"
        aria-label="Resize the document window"
        className={cn(
          "absolute size-4 touch-none",
          grip.position.vertical === "top" ? "top-0" : "bottom-0",
          grip.position.horizontal === "left" ? "left-0" : "right-0",
          // A grip on the top-left or bottom-right corner is dragged along one
          // diagonal; the other two along the other.
          (grip.position.vertical === "top") ===
            (grip.position.horizontal === "left")
            ? "cursor-nwse-resize"
            : "cursor-nesw-resize",
        )}
      >
        <div className="absolute inset-1 rounded-full border-2 border-primary/60" />
      </div>
    </div>
  );
}
