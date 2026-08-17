"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, Maximize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkDocumentPanel } from "@/features/work/components/work-document-panel";
import {
  clampSize,
  cornerOffsets,
  nearestCorner,
  type PipSize,
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
  size: savedSize,
  onCornerChange,
  onSizeChange,
  onRestore,
  onClose,
  page,
}: {
  documentId: string;
  name: string;
  corner: PipCorner;
  /** How big it was last left. Remembered between visits — see `useWorkLayout`. */
  size: PipSize;
  onCornerChange: (corner: PipCorner) => void;
  /** Called once a resize is finished, not on every frame of one. */
  onSizeChange: (size: PipSize) => void;
  onRestore: () => void;
  onClose: () => void;
  /**
   * A page to open at, when a chat citation asked for one.
   *
   * Forwarded even though the workspace restores the document on arrival: the
   * two run in the same render, so for one frame the floating window is still
   * the thing holding the viewer, and a citation followed twice in a row must
   * land either way.
   */
  page?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /**
   * The size mid-resize, before it is worth remembering.
   *
   * `null` at rest, when the remembered size is the one that counts. A drag
   * writes here on every frame and hands the result up once, on release, rather
   * than saving a hundred sizes on the way to the one that was wanted.
   */
  const [draftSize, setDraftSize] = useState<PipSize | null>(null);

  // Where the window is relative to its parked corner, mid-drag. Zero at rest —
  // the corner offsets are what place it, and this is only the deviation.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  /**
   * How much room there is to float in. `null` until it has been measured once.
   */
  const [bounds, setBounds] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const grip = resizeGrip(corner);

  /**
   * The size actually drawn: what is remembered, held within what there is room
   * for.
   *
   * Clamped here rather than written back, which is what lets a window dragged
   * out on a wide screen survive a spell in a narrow one. A window sized for the
   * room it had would otherwise be shrunk to fit the moment the page was made
   * small and stay that way, having forgotten what it was asked for.
   */
  const size = bounds
    ? clampSize(draftSize ?? savedSize, bounds)
    : (draftSize ?? savedSize);

  // The container is watched rather than only read on resize, so a window too
  // big for it is corrected before it is ever drawn hanging over an edge with
  // its grip off screen.
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
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

    // The last size the drag produced, kept here as well as in state: `handleUp`
    // is a listener registered once and closes over the render it was made in,
    // so the state it can see is the one from before the drag.
    let latest: PipSize | null = null;

    const handleMove = (move: PointerEvent) => {
      latest = clampSize(
        {
          width: startSize.width + (move.clientX - startX) * grip.signX,
          height: startSize.height + (move.clientY - startY) * grip.signY,
        },
        container.getBoundingClientRect(),
      );
      setDraftSize(latest);
    };

    const handleUp = () => {
      handle.removeEventListener("pointermove", handleMove);
      handle.removeEventListener("pointerup", handleUp);
      handle.removeEventListener("pointercancel", handleUp);

      // Nothing to remember from a grip that was pressed and let go: without
      // this, a click on it would write back the size the window happens to be
      // clamped to right now as if that were the size that had been asked for.
      if (!latest) return;

      // Handed up first and dropped after: the remembered size arrives back as
      // a prop in the same render the draft is cleared in, so the window never
      // flashes at its old size in between.
      onSizeChange(latest);
      setDraftSize(null);
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
        !isDragging &&
          "transition-[top,right,bottom,left] duration-200 ease-out",
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
        {/* <GripVertical className="size-3.5 shrink-0 text-muted-foreground" /> */}
        <span className="truncate text-xs text-muted-foreground" title={name}>
          {name}
        </span>
        {/*
          The bar swallows pointer events to drag; without stopping propagation
          each button would start a drag instead of being pressed.
        */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Restore the document panel"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRestore}
          >
            <Maximize2 />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Close the document"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <WorkDocumentPanel
          page={page} documentId={documentId} name={name} compact />
      </div>

      {/*
        One grip, on the corner facing into the container — the only corner
        whose edges are free to move. See `resizeGrip`.

        The hit area is deliberately larger than the mark inside it: a corner
        is an awkward thing to hit precisely, and the dot is only there to say
        the corner does something. Muted rather than the accent colour, so a
        floating window reads as one object instead of one with a bright pip
        stuck in it.
      */}
      <div
        onPointerDown={handleResizePointerDown}
        role="separator"
        aria-label="Resize the document window"
        className={cn(
          "group absolute size-5 touch-none",
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
        {/* <div className="absolute inset-1.5 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-muted-foreground/80" /> */}
      </div>
    </div>
  );
}
