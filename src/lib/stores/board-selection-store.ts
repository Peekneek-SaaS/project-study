import { createSelectionStore } from "@/lib/stores/create-selection-store";

/**
 * Rows ticked in the boards table.
 *
 * One kind of row, so one set of ids — where the drive needs two, because its
 * listing mixes folders and files and hands the halves to APIs that want them
 * apart. Everything else about the two selections behaves the same way, which
 * is what `createSelectionStore` is for.
 */
export const useBoardSelectionStore = createSelectionStore();
