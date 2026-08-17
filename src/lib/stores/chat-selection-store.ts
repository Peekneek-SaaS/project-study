import { createSelectionStore } from "@/lib/stores/create-selection-store";

/**
 * Conversations ticked in the recents list.
 *
 * Its own store, like the boards' and the notes' — three lists, three
 * selections, so ticks made on one page are never still held on another. The
 * shape is the shared one, which is what lets the same gesture and keyboard
 * hooks drive this table with no changes at all.
 */
export const useChatSelectionStore = createSelectionStore();
