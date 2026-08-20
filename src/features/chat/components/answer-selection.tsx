"use client";

import { CircleDashed, NotebookPen, Reply, StickyNote } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { fastTransition } from "@/lib/motion";
import { useComposerInsertStore } from "@/lib/stores/composer-insert-store";
import { useModalStore } from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";

/**
 * Selecting part of an answer offers to do something with it.
 *
 * Scoped to answers and nothing else — not questions, not the tool activity,
 * not the composer. Highlighting your own question to "reply" to it is
 * meaningless, and a toolbar that appears over every stray selection on the
 * page is one that has to be dismissed rather than one that helps.
 *
 * That scoping is what `ANSWER_ATTRIBUTE` is for: this listens to the document,
 * and then refuses anything whose selection did not start inside a marked
 * answer *within this provider*. Both halves matter — the attribute keeps it to
 * answers, and the containment check keeps a document panel's chat from
 * answering for the page's chat when both are mounted.
 */

/**
 * A subscription to something that never changes.
 *
 * `useSyncExternalStore` wants a subscribe function; "are we on the client" has
 * no updates to deliver, so this returns an unsubscribe and does nothing else.
 * At module scope, so its identity is stable across renders.
 */
const subscribeToNothing = () => () => {};

/** Marks the element whose text this toolbar is willing to act on. */
export const ANSWER_ATTRIBUTE = "data-chat-answer";

/**
 * How long a selection must sit still before the toolbar appears, in ms.
 *
 * Only ever waited out for selections with no pointer behind them — extending
 * with shift and the arrow keys, say — where there is no "let go" moment to
 * listen for. A drag does have one, and uses it, so this never adds a delay to
 * the common case.
 */
const SETTLE_MS = 250;

/** Marks the toolbar, so a press on it does not read as a new selection. */
const TOOLBAR_ATTRIBUTE = "data-selection-toolbar";

/** How far above the selection the toolbar floats, in px. */
const OFFSET = 10;

/** Kept off the viewport edges by at least this much. */
const EDGE_PADDING = 8;

interface ActiveSelection {
  text: string;
  /** Viewport coordinates, so the toolbar can be `position: fixed`. */
  top: number;
  left: number;
  /** The underside of the selection, for when the toolbar has to go below it. */
  bottom: number;
}

/**
 * Reads the current selection, if it belongs to an answer inside `root`.
 *
 * Returns null for every other case — collapsed, whitespace-only, outside an
 * answer, or inside a different provider's — so the caller has one thing to
 * check rather than five.
 */
function readAnswerSelection(root: HTMLElement | null): ActiveSelection | null {
  if (!root) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) return null;

  // `anchorNode` is usually a text node, which has no `closest` of its own.
  const anchor = selection.anchorNode;
  const element =
    anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
  if (!element) return null;

  const answer = element.closest(`[${ANSWER_ATTRIBUTE}]`);
  if (!answer || !root.contains(answer)) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  // A zero-sized rect means the range is not laid out — mid-reflow, or a
  // selection inside a hidden element. Positioning against it would park the
  // toolbar in the corner.
  if (rect.width === 0 && rect.height === 0) return null;

  return {
    text,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left + rect.width / 2,
  };
}

export function AnswerSelectionProvider({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<ActiveSelection | null>(null);

  /**
   * Whether there is a `document` to portal into yet.
   *
   * A bare `typeof document !== "undefined"` reads the same and is not the
   * same: it is already true on the client's *first* render, so the server
   * produces one child and hydration produces two, and React reconciles a tree
   * that does not match.
   *
   * `useSyncExternalStore` states the difference directly — false on the
   * server, true on the client — which is exactly what it is for. The obvious
   * alternative, flipping a `useState` from an effect, is a synchronous
   * setState inside an effect body: a cascading render, and one the React
   * Compiler refuses. Nothing is lost by arriving a render late, because there
   * is never a selection to show on the first frame anyway.
   */
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const openModal = useModalStore((state) => state.open);
  const insertIntoComposer = useComposerInsertStore((state) => state.insert);

  /**
   * Whether a pointer is currently down, and the pending settle timer.
   *
   * Refs rather than state: nothing renders from either, and putting them in
   * state would re-render the whole transcript on every mousedown.
   */
  const isDragging = useRef(false);
  const settleTimer = useRef<number | null>(null);

  const cancelSettle = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  /** Reads the selection and shows the toolbar for it, right now. */
  const commit = useCallback(() => {
    cancelSettle();
    setSelection(readAnswerSelection(rootRef.current));
  }, [cancelSettle]);

  useEffect(() => {
    /**
     * The selection moved.
     *
     * `selectionchange` fires on every pixel of a drag, so acting on it
     * directly put the toolbar on screen the instant a gesture started and then
     * had it chase the cursor across the answer. What is wanted is the opposite:
     * nothing while the selection is being made, and the toolbar once it has
     * settled.
     *
     * So this only ever *hides*. Showing is left to whichever signal means the
     * gesture is over — `pointerup` for a drag, the timer below for a keyboard
     * selection, which has no such event to wait for.
     */
    const handleSelectionChange = () => {
      setSelection(null);
      cancelSettle();

      // A drag in progress ends in `pointerup`, which is exact. Waiting on a
      // timer as well would show the toolbar mid-drag on a slow, careful one.
      if (isDragging.current) return;

      settleTimer.current = window.setTimeout(commit, SETTLE_MS);
    };

    /**
     * A press starts a gesture — unless it is a press on the toolbar itself.
     *
     * Without that exception, reaching for "Reply" would count as the start of
     * a new selection and take the toolbar away from under the pointer before
     * the click landed.
     */
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(`[${TOOLBAR_ATTRIBUTE}]`)
      ) {
        return;
      }

      isDragging.current = true;
      cancelSettle();
      setSelection(null);
    };

    // The gesture is definitively over. Bound to the window rather than the
    // root because a drag that began in an answer very often ends outside one.
    const handlePointerUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      commit();
    };

    /**
     * Keeps an already-visible toolbar glued to its text.
     *
     * Immediate rather than debounced, and not routed through the hide-first
     * path above: the selection has not changed, only moved, so there is
     * nothing to wait for and hiding it mid-scroll would make it blink.
     *
     * Captured, because the transcript scrolls in its own container rather than
     * on the window, and a bubbling listener would never hear it.
     */
    const handleReposition = () => {
      if (isDragging.current) return;
      commit();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      cancelSettle();
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerUp, true);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [cancelSettle, commit]);

  const toolbarRef = useRef<HTMLDivElement>(null);

  /**
   * Puts the toolbar where the selection is, and never off the screen.
   *
   * Centred on the selection is right in the middle of a paragraph and wrong at
   * either end of one: the toolbar is a couple of hundred pixels wide, so a
   * first or last word near an edge centres it half outside the viewport, and
   * half the buttons cannot be reached. Both axes are therefore clamped to the
   * viewport rather than trusted to the selection.
   *
   * Vertically it does not clamp but *flips*. The toolbar sits above the words
   * it describes, so a selection in the top line has nowhere above it to sit —
   * pinning it to the top edge would only park it over the very text it is
   * about. Below the selection is the same distance from the same words, and it
   * is what every editor does in that position.
   *
   * Written to the DOM in a layout effect rather than rendered as style, and
   * measured with `offset*` rather than `getBoundingClientRect`: the box is
   * mid-animation when this runs, and a rect would report the width it has
   * *scaled to* rather than the width it lays out at, which would centre it a
   * few pixels wrong on every appearance. A layout effect lands before paint,
   * so nothing is ever seen in the unclamped position.
   */
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || !selection) return;

    const width = toolbar.offsetWidth;
    const height = toolbar.offsetHeight;

    const half = width / 2;
    const leftLimit = EDGE_PADDING + half;
    const rightLimit = window.innerWidth - EDGE_PADDING - half;
    // The two limits cross over on a viewport narrower than the toolbar, where
    // there is no position that satisfies both. The left one wins, because a
    // row of buttons is read from its left edge.
    const centre = Math.min(
      Math.max(selection.left, leftLimit),
      Math.max(leftLimit, rightLimit),
    );

    const above = selection.top - OFFSET - height;

    toolbar.style.left = `${centre - half}px`;
    toolbar.style.top =
      above >= EDGE_PADDING ? `${above}px` : `${selection.bottom + OFFSET}px`;
  }, [selection]);

  /**
   * Puts the selection down before acting on it.
   *
   * Both actions take the user's attention elsewhere — a modal, the composer —
   * and a highlight left behind under a dialog reads as an unfinished gesture.
   * The text is captured first, because clearing the selection destroys it.
   */
  const consume = useCallback((action: (text: string) => void) => {
    const current = readAnswerSelection(rootRef.current);
    if (!current) return;

    action(current.text);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  return (
    <div ref={rootRef} className={cn("contents", className)}>
      {children}

      {/*
        Portalled to the body so the transcript's `overflow` cannot clip it.
        Positioned in viewport coordinates, which is why everything above works
        in `getBoundingClientRect` terms rather than offsets.
      */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selection && (
              <motion.div
                ref={toolbarRef}
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={fastTransition}
                {...{ [TOOLBAR_ATTRIBUTE]: "" }}
                // `top` and `left` are the layout effect's above — set from the
                // measured box, which is the only way to know whether it fits.
                // No translate here either: half of it used to be worked out by
                // `-translate-x-1/2`, and a correction that has to fight a
                // transform it cannot see is a correction that is wrong.
                className="fixed z-50"
                // The toolbar must not steal the selection it describes: a
                // mousedown inside it would collapse the range before the click
                // handler ever ran.
                onMouseDown={(event) => event.preventDefault()}
              >
                <ButtonGroup className="rounded-md border bg-popover shadow-md">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() =>
                      consume((text) =>
                        openModal("paste-into", { kind: "notes", text }),
                      )
                    }
                  >
                    <StickyNote className="size-3.5 fill-yellow-400 stroke-yellow-200" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() =>
                      consume((text) =>
                        openModal("paste-into", { kind: "todos", text }),
                      )
                    }
                  >
                    <CircleDashed className="size-3.5  stroke-red-500 stroke-2.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => consume(insertIntoComposer)}
                  >
                    <Reply className="size-3.5" />
                    Reply
                  </Button>
                </ButtonGroup>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
