import { create } from "zustand";

/**
 * Rows ticked in one list, addressed by a single string key.
 *
 * A factory rather than a store: two lists on two pages are two selections, and
 * sharing one would leave the boards page holding ticks made in the drive. Each
 * feature makes its own and exports it — see `board-selection-store`.
 *
 * The drive keeps a store of its own (`drive-selection-store`) because it ticks
 * two kinds of row at once and hands the halves to APIs that want them apart.
 * It could be folded onto this by keying its rows `kind:id`, but that reaches
 * into a dozen working files, so it is left where it is.
 */
export interface ListSelectionStore {
  ids: Set<string>;
  /**
   * The row a shift-click measures its range from — the last one picked
   * deliberately, which is not always the last one selected: extending a range
   * leaves the anchor where it was so the range can be redrawn shorter.
   */
  anchor: string | null;
  /** Replaces the selection with one row — a plain click. */
  selectOnly: (id: string) => void;
  /** Adds or removes one row, leaving the rest — a ⌘/ctrl-click. */
  toggle: (id: string) => void;
  /** Selects a whole list (or a shift-click's range) at once. */
  setAll: (ids: string[], anchor?: string | null) => void;
  clear: () => void;
}

/** `delete` reports whether it removed anything, which is the toggle itself. */
const toggled = (ids: Set<string>, id: string) => {
  const next = new Set(ids);
  if (!next.delete(id)) next.add(id);
  return next;
};

export function createSelectionStore() {
  return create<ListSelectionStore>((set) => ({
    ids: new Set(),
    anchor: null,

    selectOnly: (id) => set({ ids: new Set([id]), anchor: id }),

    toggle: (id) =>
      set((state) => ({ ids: toggled(state.ids, id), anchor: id })),

    setAll: (ids, anchor = null) => set({ ids: new Set(ids), anchor }),

    clear: () => set({ ids: new Set(), anchor: null }),
  }));
}

/**
 * Whether one row is selected.
 *
 * Returns a boolean, so a row only re-renders when its own state changes —
 * selecting a different row is a no-op for it.
 */
export const selectIsRowSelected = (id: string) => (state: ListSelectionStore) =>
  state.ids.has(id);

/** Whether anything at all is selected. Boolean, for the same reason. */
export const selectHasSelection = (state: ListSelectionStore) =>
  state.ids.size > 0;
