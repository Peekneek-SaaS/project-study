// lib/stores/drive-store.ts
import { create } from "zustand";

export interface DriveCrumb {
  id: string;
  name: string;
}

interface DriveStore {
  /** Folders opened from the root, in order. Empty means we are at the root. */
  trail: DriveCrumb[];
  /** Descend into a folder. Ignored if it is already on the trail. */
  openFolder: (folder: DriveCrumb) => void;
  /** Jump back to a folder on the trail, or to the root when given `null`. */
  goToCrumb: (id: string | null) => void;
  /** Drop a folder off the trail if it disappears (moved, renamed away, deleted). */
  dropCrumb: (id: string) => void;
  /** Relabel a folder on the trail after it is renamed. No-op if it is not on it. */
  renameCrumb: (id: string, name: string) => void;
}

export const useDriveStore = create<DriveStore>((set) => ({
  trail: [],

  openFolder: (folder) =>
    set((state) =>
      state.trail.some((crumb) => crumb.id === folder.id)
        ? state
        : { trail: [...state.trail, folder] },
    ),

  goToCrumb: (id) =>
    set((state) => {
      if (id === null) return { trail: [] };
      const index = state.trail.findIndex((crumb) => crumb.id === id);
      return index === -1 ? state : { trail: state.trail.slice(0, index + 1) };
    }),

  dropCrumb: (id) =>
    set((state) => {
      const index = state.trail.findIndex((crumb) => crumb.id === id);
      return index === -1 ? state : { trail: state.trail.slice(0, index) };
    }),

  // The breadcrumb reads names off the trail rather than refetching them, so a
  // rename has to be told to it or the crumb keeps the old label.
  renameCrumb: (id, name) =>
    set((state) =>
      state.trail.some((crumb) => crumb.id === id)
        ? {
            trail: state.trail.map((crumb) =>
              crumb.id === id ? { ...crumb, name } : crumb,
            ),
          }
        : state,
    ),
}));

/** Folder being browsed, or `null` at the root. */
export const selectCurrentFolderId = (state: DriveStore) =>
  state.trail.at(-1)?.id ?? null;

/** Folder containing the one being browsed. `null` means the root. */
export const selectParentFolderId = (state: DriveStore) =>
  state.trail.at(-2)?.id ?? null;
