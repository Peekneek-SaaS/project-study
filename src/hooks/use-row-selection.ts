"use client";

import { useCallback, useEffect, useMemo } from "react";

import {
  focusRow,
  type RowSelectModifiers,
} from "@/hooks/use-row-interaction";
import type { createSelectionStore } from "@/lib/stores/create-selection-store";
import { useModalStore } from "@/lib/stores/modal-store";
import { useSearchStore } from "@/lib/stores/search-store";

/** Whatever `createSelectionStore` hands back — a hook with `getState` on it. */
type SelectionStoreHook = ReturnType<typeof createSelectionStore>;

/** A row, in the order the list draws it, and what opening it does. */
export interface RowEntry {
  id: string;
  open: () => void;
}

/**
 * Selection for one list: what a click means, and what the keyboard does.
 *
 * Lives here rather than in the row because both questions are about *order* —
 * which rows sit between the anchor and the one clicked, which row is below
 * this one — and a row on its own cannot answer either.
 *
 * The store is passed in rather than imported so each list keeps its own ticks;
 * see `createSelectionStore`.
 */
export function useRowSelection(
  rows: RowEntry[],
  useSelectionStore: SelectionStoreHook,
) {
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);

  const selectRow = useCallback(
    (modifiers: RowSelectModifiers, id: string) => {
      // Read at click time rather than subscribed to, so this handler is not
      // rebuilt every time the selection changes.
      const { anchor, toggle, selectOnly, setAll } =
        useSelectionStore.getState();

      if (modifiers.shiftKey && anchor) {
        const from = ids.indexOf(anchor);
        const to = ids.indexOf(id);

        // A missing anchor means the row it named has left the list; fall
        // through and treat the click as the start of a new range.
        if (from !== -1 && to !== -1) {
          const [start, end] = from <= to ? [from, to] : [to, from];
          // The anchor stays put, so dragging the shift-click back up the list
          // shortens the range instead of pinning it at its widest.
          setAll(ids.slice(start, end + 1), anchor);
          return;
        }
      }

      if (modifiers.metaKey || modifiers.ctrlKey) {
        toggle(id);
        return;
      }

      selectOnly(id);
    },
    [ids, useSelectionStore],
  );

  const selectAll = useCallback(() => {
    useSelectionStore.getState().setAll(ids);
  }, [ids, useSelectionStore]);

  /**
   * The keyboard half: arrows walk the list, Enter opens what is selected.
   *
   * Bound to the window rather than to the rows because a selection is the
   * page's state, not the focused element's — clicking a row selects it without
   * necessarily focusing it, and Enter still has to work afterwards. Anything
   * with a better claim on the keys (a dialog, the search palette, a text
   * field) is left alone.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Already spoken for — a row's own Enter, or a drag being cancelled.
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (useModalStore.getState().type !== null) return;
      if (useSearchStore.getState().isOpen) return;

      const { ids: selected, anchor, clear, selectOnly } =
        useSelectionStore.getState();

      if (event.key === "Escape") {
        clear();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
        return;
      }

      if (event.key === "Enter") {
        // One row opens; a pile of them has no single answer, so it waits.
        if (selected.size !== 1) return;
        const row = rows.find((entry) => selected.has(entry.id));
        if (!row) return;
        event.preventDefault();
        row.open();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (rows.length === 0) return;
        event.preventDefault();

        // The anchor is the cursor: it is the row last picked deliberately,
        // which is where a keyboard user expects to carry on from.
        const current = anchor ? ids.indexOf(anchor) : -1;
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next =
          current === -1
            ? step === 1
              ? 0
              : rows.length - 1
            : Math.min(Math.max(current + step, 0), rows.length - 1);

        selectOnly(ids[next]);
        focusRow(ids[next]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ids, rows, selectAll, useSelectionStore]);

  return { selectRow, selectAll };
}
