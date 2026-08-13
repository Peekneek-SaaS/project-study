// lib/stores/search-store.ts
import { create } from "zustand";

/**
 * The search palette, kept out of `modal-store` deliberately.
 *
 * That store holds one modal at a time, so opening the palette would tear down
 * whatever was already on screen — and the palette needs to survive doing the
 * opposite: it hands a document to the preview modal and closes itself. It also
 * carries the typed query, which is state no other modal has.
 */
interface SearchStore {
  isOpen: boolean;
  /** What is typed into the palette. Reset every time it opens or closes. */
  query: string;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  isOpen: false,
  query: "",
  open: () => set({ isOpen: true, query: "" }),
  close: () => set({ isOpen: false, query: "" }),
  setQuery: (query) => set({ query }),
}));
