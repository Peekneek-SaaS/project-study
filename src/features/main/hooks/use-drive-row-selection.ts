"use client";

import { useCallback, useEffect, useMemo } from "react";

import type { SelectRow } from "@/features/main/hooks/use-drive-row-interaction";
import { useOpenDocument } from "@/features/main/hooks/use-open-document";
import type { DriveDocument, DriveFolder } from "@/features/main/types";
import {
  type DriveItemKey,
  useDriveSelectionStore,
} from "@/lib/stores/drive-selection-store";
import { useDriveStore } from "@/lib/stores/drive-store";
import { useModalStore } from "@/lib/stores/modal-store";
import { useSearchStore } from "@/lib/stores/search-store";

/** A row, in the order the table draws it, and what opening it does. */
interface DriveRowEntry {
  key: DriveItemKey;
  open: () => void;
}

const sameItem = (a: DriveItemKey, b: DriveItemKey) =>
  a.kind === b.kind && a.id === b.id;

/** Splits a run of rows back into the two id lists the store keeps. */
const split = (items: DriveItemKey[]) => ({
  folderIds: items.filter((i) => i.kind === "folder").map((i) => i.id),
  documentIds: items.filter((i) => i.kind === "document").map((i) => i.id),
});

/** Follows the selection with the browser's focus, so Enter has something to act on. */
const focusRow = ({ kind, id }: DriveItemKey) => {
  const row = document.querySelector<HTMLElement>(
    `[data-drive-row="${kind}:${id}"]`,
  );
  row?.focus({ preventScroll: true });
  row?.scrollIntoView({ block: "nearest" });
};

/**
 * Selection for one listing: what a click means, and what the keyboard does.
 *
 * Lives here rather than in the row because both questions are about *order* —
 * which rows sit between the anchor and the one clicked, which row is below
 * this one — and a row on its own cannot answer either. Folders come before
 * documents because that is how the table renders them.
 */
export function useDriveRowSelection(
  folders: DriveFolder[],
  documents: DriveDocument[],
) {
  const openFolder = useDriveStore((state) => state.openFolder);
  const openDocument = useOpenDocument();

  const rows = useMemo<DriveRowEntry[]>(
    () => [
      ...folders.map((folder) => ({
        key: { kind: "folder" as const, id: folder.id },
        open: () => openFolder({ id: folder.id, name: folder.name }),
      })),
      ...documents.map((doc) => ({
        key: { kind: "document" as const, id: doc.id },
        open: () => openDocument(doc),
      })),
    ],
    [folders, documents, openFolder, openDocument],
  );

  const selectRow = useCallback<SelectRow>(
    (modifiers, item) => {
      // Read at click time rather than subscribed to, so this handler is not
      // rebuilt every time the selection changes.
      const { anchor, toggle, selectOnly, setAll } =
        useDriveSelectionStore.getState();

      if (modifiers.shiftKey && anchor) {
        const from = rows.findIndex((row) => sameItem(row.key, anchor));
        const to = rows.findIndex((row) => sameItem(row.key, item));

        // A missing anchor means the row it named has left the listing; fall
        // through and treat the click as the start of a new range.
        if (from !== -1 && to !== -1) {
          const [start, end] = from <= to ? [from, to] : [to, from];
          // The anchor stays put, so dragging the shift-click back up the list
          // shortens the range instead of pinning it at its widest.
          setAll(
            split(rows.slice(start, end + 1).map((row) => row.key)),
            anchor,
          );
          return;
        }
      }

      if (modifiers.metaKey || modifiers.ctrlKey) {
        toggle(item);
        return;
      }

      selectOnly(item);
    },
    [rows],
  );

  const selectAll = useCallback(() => {
    useDriveSelectionStore.getState().setAll(split(rows.map((row) => row.key)));
  }, [rows]);

  /**
   * The keyboard half: arrows walk the listing, Enter opens what is selected.
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

      const { folderIds, documentIds, anchor, clear, selectOnly } =
        useDriveSelectionStore.getState();
      const selectedCount = folderIds.size + documentIds.size;

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
        if (selectedCount !== 1) return;
        const selected = rows.find((row) =>
          row.key.kind === "folder"
            ? folderIds.has(row.key.id)
            : documentIds.has(row.key.id),
        );
        if (!selected) return;
        event.preventDefault();
        selected.open();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (rows.length === 0) return;
        event.preventDefault();

        // The anchor is the cursor: it is the row last picked deliberately,
        // which is where a keyboard user expects to carry on from.
        const current = anchor
          ? rows.findIndex((row) => sameItem(row.key, anchor))
          : -1;
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next =
          current === -1
            ? step === 1
              ? 0
              : rows.length - 1
            : Math.min(Math.max(current + step, 0), rows.length - 1);

        selectOnly(rows[next].key);
        focusRow(rows[next].key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selectAll]);

  return { selectRow, selectAll };
}
