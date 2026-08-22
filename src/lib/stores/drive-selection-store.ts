// lib/stores/drive-selection-store.ts
import { create } from "zustand";

/** One row in the listing, addressed the way the table renders it. */
export interface DriveItemKey {
  kind: "folder" | "document";
  id: string;
}

/**
 * Rows selected in the drive table.
 *
 * Kept apart from `useDriveNavigation`, which only knows where you are: a selection
 * belongs to one listing and is dropped the moment you leave it, so the two
 * have opposite lifetimes. Ids live in `Set`s so a row can ask about itself
 * without reading the whole selection.
 */
interface DriveSelectionStore {
  folderIds: Set<string>;
  documentIds: Set<string>;
  /**
   * The row a shift-click measures its range from — the last one picked
   * deliberately, which is not always the last one selected: extending a range
   * leaves the anchor where it was so the range can be redrawn shorter.
   */
  anchor: DriveItemKey | null;
  /**
   * Whether the drag in flight is carrying the selection. Lives here because
   * the rows that need to look like they are moving are exactly the selected
   * ones, and dnd-kit only tells the row being held about the drag.
   */
  isDraggingSelection: boolean;
  /** Replaces the selection with one row — a plain click. */
  selectOnly: (item: DriveItemKey) => void;
  /** Adds or removes one row, leaving the rest — a ⌘/ctrl-click. */
  toggle: (item: DriveItemKey) => void;
  /** Selects a whole listing (or a shift-click's range) at once. */
  setAll: (
    selection: { folderIds: string[]; documentIds: string[] },
    anchor?: DriveItemKey | null,
  ) => void;
  setDraggingSelection: (dragging: boolean) => void;
  clear: () => void;
}

/** `delete` reports whether it removed anything, which is the toggle itself. */
const toggled = (ids: Set<string>, id: string) => {
  const next = new Set(ids);
  if (!next.delete(id)) next.add(id);
  return next;
};

export const useDriveSelectionStore = create<DriveSelectionStore>((set) => ({
  folderIds: new Set(),
  documentIds: new Set(),
  anchor: null,
  isDraggingSelection: false,

  selectOnly: (item) =>
    set({
      folderIds: new Set(item.kind === "folder" ? [item.id] : []),
      documentIds: new Set(item.kind === "document" ? [item.id] : []),
      anchor: item,
    }),

  toggle: (item) =>
    set((state) =>
      item.kind === "folder"
        ? { folderIds: toggled(state.folderIds, item.id), anchor: item }
        : { documentIds: toggled(state.documentIds, item.id), anchor: item },
    ),

  setAll: ({ folderIds, documentIds }, anchor = null) =>
    set({
      folderIds: new Set(folderIds),
      documentIds: new Set(documentIds),
      anchor,
    }),

  setDraggingSelection: (isDraggingSelection) => set({ isDraggingSelection }),

  clear: () =>
    set({
      folderIds: new Set(),
      documentIds: new Set(),
      anchor: null,
      isDraggingSelection: false,
    }),
}));

/**
 * Whether one row is selected.
 *
 * Returns a boolean, so a row only re-renders when its own state changes —
 * selecting a different row is a no-op for it.
 */
export const selectIsFolderSelected =
  (id: string) => (state: DriveSelectionStore) =>
    state.folderIds.has(id);

export const selectIsDocumentSelected =
  (id: string) => (state: DriveSelectionStore) =>
    state.documentIds.has(id);

export const selectIsSelected =
  ({ kind, id }: DriveItemKey) =>
  (state: DriveSelectionStore) =>
    kind === "folder" ? state.folderIds.has(id) : state.documentIds.has(id);

/** Whether anything at all is selected. Boolean, for the same reason. */
export const selectHasSelection = (state: DriveSelectionStore) =>
  state.folderIds.size > 0 || state.documentIds.size > 0;
