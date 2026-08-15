import { createSelectionStore } from "@/lib/stores/create-selection-store";

/**
 * Notes ticked on the wall.
 *
 * Its own store rather than the boards' one — two pages, two selections — but
 * the same shape, so the shared gesture and keyboard hooks work here unchanged.
 */
export const useNoteSelectionStore = createSelectionStore();
