"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isMeaningfulSelection,
  rangeToAnchors,
  truncateQuote,
  unionOfAnchors,
  type AnchorRect,
} from "@/features/annotations/lib/anchor";

/** A selection sitting on a page, resolved into somewhere a note can go. */
export interface DocumentSelection {
  pageNumber: number;
  /** The bounding box, for the row's own columns and for positioning. */
  anchor: AnchorRect;
  /** One box per line the selection covers — what actually gets painted. */
  rects: AnchorRect[];
  quote: string;
}

/**
 * How long a selection must sit still before it is offered, in ms.
 *
 * Only ever waited out for selections with no pointer behind them — extending
 * with shift and the arrow keys — where there is no "let go" moment to listen
 * for. A drag has one and uses it, so this never delays the common case. The
 * same trick, and the same figure, as the chat's answer toolbar.
 */
const SETTLE_MS = 250;

/**
 * Watches for text selected inside a viewer, and works out where it is.
 *
 * Deliberately knows nothing about PDFs. All three viewers lay their content
 * out the same way underneath — a box per page or slide, at a fixed size, with
 * a CSS transform doing the zooming — so all any of them has to do is mark
 * those boxes with `data-page` and this works. That is the whole of what makes
 * the same feature run on a .pdf, a .docx and a .pptx.
 *
 * Scoped twice over, and both halves matter. The listener is on the document —
 * it has to be, because that is where selection events are delivered — so the
 * first check is that the selection began inside a `[data-page]` element, which
 * keeps it to the rendered pages and off the toolbar, the page numbers and
 * everything else on screen. The second is that the page found belongs to
 * *this* viewer: the work page can hold a document panel and a floating window
 * showing the same file, and without the containment check a selection in one
 * would offer a note anchored through the other.
 *
 * Returns the selection and a way to forget it. Forgetting is the caller's job
 * because the caller knows when it is done — the prompt is dismissed, the note
 * is written — and clearing on the next `selectionchange` would take the
 * prompt away as soon as the user clicked the button on it.
 */
export function useDocumentSelection(
  rootRef: React.RefObject<HTMLElement | null>,
  /** Off entirely when the viewer has no document to file notes against. */
  enabled: boolean,
) {
  const [selection, setSelection] = useState<DocumentSelection | null>(null);

  /**
   * The pending re-read, in a ref so that dismissing can cancel it.
   *
   * It used to be a local of the effect below, which is what made the prompt
   * impossible to close: `pointerup` fires before `click`, so pressing the
   * dismiss button had already queued a read by the time the handler ran. That
   * read then found the words still selected — nothing had told the browser to
   * let go of them — and put the prompt straight back up.
   */
  const settleTimer = useRef<number | null>(null);

  const clearSelection = useCallback(() => {
    // Whatever was queued is for the selection being dismissed. Cancelled first,
    // so it cannot arrive a tick later and undo this.
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }

    /*
      And let go of the words themselves.

      Without this the browser's highlight stays on the sentence after the
      prompt has gone, which reads as the prompt still being open — and any
      later `selectionchange`, from a click anywhere on the page, would find
      that range still sitting there and offer to annotate it again.

      This does itself fire `selectionchange`, which schedules one more read.
      That one is harmless: it finds an empty selection and returns before it
      reaches anything.
    */
    window.getSelection()?.removeAllRanges();

    setSelection(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const read = () => {
      const root = rootRef.current;
      if (!root) return;

      const current = window.getSelection();
      if (!current || current.isCollapsed || current.rangeCount === 0) return;

      const text = current.toString();
      if (!isMeaningfulSelection(text)) return;

      // `anchorNode` is usually a text node, which has no `closest` of its own.
      const node = current.anchorNode;
      const element =
        node instanceof Element ? node : (node?.parentElement ?? null);
      if (!element) return;

      const pageEl = element.closest<HTMLElement>("[data-page]");
      if (!pageEl || !root.contains(pageEl)) return;

      const pageNumber = Number(pageEl.getAttribute("data-page"));
      if (!Number.isFinite(pageNumber) || pageNumber < 1) return;

      // Per line, not one box round the lot — see `rangeToAnchors`. An empty
      // result means the range is not laid out: mid-reflow, or inside a page
      // the render window has just unmounted. Anchoring to that would park the
      // note in the page's top-left corner.
      const rects = rangeToAnchors(current.getRangeAt(0), pageEl);
      const anchor = unionOfAnchors(rects);
      if (!anchor) return;

      setSelection({
        pageNumber,
        anchor,
        rects,
        quote: truncateQuote(text),
      });
    };

    // A drag has an end to listen for, and reading on it means the prompt
    // appears the instant the button comes up rather than a beat later.
    const handlePointerUp = () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      // Queued rather than run inline: on `pointerup` the selection is still
      // the one from before the gesture finished in some browsers.
      settleTimer.current = window.setTimeout(read, 0);
    };

    // Keyboard selection has no such moment, so it waits for the range to stop
    // moving instead. Restarted on every change, so holding shift-arrow down
    // fires once at the end rather than on every character.
    const handleSelectionChange = () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(read, SETTLE_MS);
    };

    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [enabled, rootRef]);

  return { selection, clearSelection };
}
