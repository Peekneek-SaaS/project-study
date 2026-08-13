// lib/stores/modal-store.ts
import { create } from "zustand";

/** What the delete modal is being asked to remove. */
export interface DeleteTarget {
  kind: "document" | "folder";
  id: string;
  /** Shown in the confirmation, and in the toast after the row is gone. */
  name: string;
}

/**
 * Every modal the app can open, with whatever it needs to be opened *with*.
 * `undefined` means the modal reads everything it needs from other stores.
 *
 * Add one here, render it in `ModalProvider`.
 */
interface ModalPayloads {
  "upload-file": undefined;
  "create-folder": undefined;
  "delete-item": DeleteTarget;
}

export type ModalType = keyof ModalPayloads;

/** Payload-less modals open with just their name; the rest must pass theirs. */
type OpenArgs<T extends ModalType> = ModalPayloads[T] extends undefined
  ? [type: T]
  : [type: T, payload: ModalPayloads[T]];

interface ModalStore {
  /** Modal currently on screen, or `null` when none is. One at a time. */
  type: ModalType | null;
  /** What that modal was opened with. Cleared alongside `type`. */
  payload: ModalPayloads[ModalType];
  open: <T extends ModalType>(...args: OpenArgs<T>) => void;
  close: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  payload: undefined,
  open: (type, payload?: ModalPayloads[ModalType]) => set({ type, payload }),
  close: () => set({ type: null, payload: undefined }),
}));

/**
 * Open state of a single modal.
 *
 * Returns a boolean, so a modal only re-renders when its own state flips —
 * opening a different one is a no-op for it.
 */
export const selectIsOpen = (type: ModalType) => (state: ModalStore) =>
  state.type === type;

/**
 * What the delete modal should remove, or `null` when it is not the modal on
 * screen. Guarded by `type` so a stale payload can never be read as a target.
 */
export const selectDeleteTarget = (state: ModalStore) =>
  state.type === "delete-item" ? (state.payload as DeleteTarget) : null;
