import { createSelectionStore } from "@/lib/stores/create-selection-store";

/**
 * Tasks ticked on the todo page.
 *
 * Its own store — one page, one selection, as with the notes wall and the
 * boards — and the same shape, so the shared gesture and keyboard hooks work
 * here unchanged.
 *
 * "Ticked" here means picked out, not completed. A todo has a second, unrelated
 * sense of the word living on the row itself: the circle on the left is whether
 * the task is *done*, and nothing in this store touches it.
 */
export const useTodoSelectionStore = createSelectionStore();
