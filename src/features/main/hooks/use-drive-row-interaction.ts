"use client";

import {
  type RowSelectModifiers,
  useRowInteraction,
} from "@/hooks/use-row-interaction";
import {
  type DriveItemKey,
  selectHasSelection,
  useDriveSelectionStore,
} from "@/lib/stores/drive-selection-store";

export type { RowSelectModifiers };

export type SelectRow = (
  modifiers: RowSelectModifiers,
  item: DriveItemKey,
) => void;

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
 * The drive's rows, wired to the shared gesture hook.
 *
 * All the behaviour lives in `useRowInteraction`; what is left here is the
 * drive's own shape — a row is a `kind` and an `id` rather than one key, and
 * the ticks live in the drive's two-set store. Shared by every row and card so
 * the two views cannot drift apart, and now with the boards list as well.
 */
export function useDriveRowInteraction({
  item,
  isDragging,
  onOpen,
  onSelect,
}: DriveRowInteractionOptions) {
  const toggle = useDriveSelectionStore((state) => state.toggle);
  const hasSelection = useDriveSelectionStore(selectHasSelection);

  return useRowInteraction({
    rowKey: `${item.kind}:${item.id}`,
    isDragging,
    hasSelection,
    onToggle: () => toggle(item),
    onOpen,
    onSelect: (modifiers) => onSelect(modifiers, item),
  });
}
