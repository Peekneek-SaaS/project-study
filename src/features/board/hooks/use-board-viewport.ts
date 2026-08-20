"use client";

import { useCallback, useEffect, useRef } from "react";
import type { AppState } from "@excalidraw/excalidraw/types";

/** One entry per board, so two boards do not share a place to be looked at. */
const STORAGE_PREFIX = "study:board-viewport:";

/**
 * Long enough that a pan is one write rather than one per frame, short enough
 * that a tab closed straight after a scroll still remembers where it was.
 */
const WRITE_DEBOUNCE_MS = 400;

/** Where a board was last being looked at, and how closely. */
export type BoardViewport = {
  scrollX: number;
  scrollY: number;
  zoom: number;
};

/**
 * Where the viewport lives, and why it is not in the database with the scene.
 *
 * Panning and zooming do not change the drawing — the autosave says as much,
 * and skips them deliberately — so putting them in the snapshot would mean a
 * round trip for every scroll wheel, and a board whose `updatedAt` moved every
 * time somebody looked at it. It is also not really a property of the board:
 * two people, or one person on a laptop and a phone, are each somewhere
 * different in the same drawing, and the last one to scroll should not drag the
 * other's view along with them.
 *
 * So it goes to `localStorage`, alongside the shape library — the same tradeoff
 * spelled out there: this is the part of a board's world that belongs to a
 * browser rather than to an account, and it does not follow anyone to a second
 * device. The seam is this file; moving it to the server means a table and a
 * router, not a change at the call site.
 *
 * Entries outlive the boards they describe — deleting a board does not come
 * through here — but each is a few dozen bytes and a key that is never read
 * again costs nothing but the space.
 */
export function readBoardViewport(boardId: string): BoardViewport | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + boardId);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { scrollX, scrollY, zoom } = parsed as Record<string, unknown>;

    // Every field checked rather than trusted. This is user-writable storage
    // that may also have been written by an older shape of this app, and a
    // `NaN` scroll offset does not throw — it silently puts the canvas
    // nowhere, which looks exactly like a board that lost its contents.
    if (
      !isFiniteNumber(scrollX) ||
      !isFiniteNumber(scrollY) ||
      !isFiniteNumber(zoom) ||
      zoom <= 0
    ) {
      return null;
    }

    return { scrollX, scrollY, zoom };
  } catch {
    // Corrupt, or a browser refusing storage entirely. Opening the board where
    // it was is a convenience; refusing to open it is not.
    return null;
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Keeps a board's viewport where the reader left it.
 *
 * Returned as a callback for `onChange` rather than wired to Excalidraw itself,
 * because Excalidraw reports the viewport in the same breath as everything else
 * — the autosave takes the elements out of that call, and this takes the scroll
 * and the zoom. Both ignore what the other cares about.
 *
 * The write is debounced and skipped when nothing moved: `onChange` fires on
 * pointer moves, and a `localStorage.setItem` per frame of a drag is a real
 * cost for a value only ever read once, on the next visit.
 */
export function useBoardViewport(boardId: string) {
  const pending = useRef<BoardViewport | null>(null);
  const written = useRef<BoardViewport | null>(null);
  const timer = useRef<number | null>(null);

  const write = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const next = pending.current;
    if (!next) return;
    pending.current = null;

    try {
      localStorage.setItem(STORAGE_PREFIX + boardId, JSON.stringify(next));
      written.current = next;
    } catch {
      // Private mode, a full quota, storage switched off. The board still
      // works; it just opens where it always used to.
    }
  }, [boardId]);

  const remember = useCallback(
    (appState: Pick<AppState, "scrollX" | "scrollY" | "zoom">) => {
      const next: BoardViewport = {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom.value,
      };

      const last = pending.current ?? written.current;
      if (
        last &&
        last.scrollX === next.scrollX &&
        last.scrollY === next.scrollY &&
        last.zoom === next.zoom
      ) {
        // A change to something else entirely — an element, a selection, the
        // active tool. The view did not move, so there is nothing to record.
        return;
      }

      pending.current = next;

      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(write, WRITE_DEBOUNCE_MS);
    },
    [write],
  );

  // Leaving the page mid-debounce is the common case — a pan, then straight
  // back to the listing — and it is the one that would otherwise be lost.
  useEffect(() => {
    return () => {
      write();
    };
  }, [write]);

  return remember;
}
