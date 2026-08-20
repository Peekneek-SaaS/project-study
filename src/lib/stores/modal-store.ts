// lib/stores/modal-store.ts
import { create } from "zustand";

import type { PasteIntoTarget } from "@/features/main/lib/paste-targets";

/** A single drive row a modal is acting on. */
export interface DriveItemTarget {
  kind: "document" | "folder";
  id: string;
  /** Shown in the dialog, and in the toast once the row has changed. */
  name: string;
}

/** What the delete modal is being asked to remove. */
export type DeleteTarget = DriveItemTarget;

/** The row the rename modal is editing, carrying the name to start from. */
export type RenameTarget = DriveItemTarget;

/** The ticked rows the bulk delete is being asked to remove. */
export interface DeleteSelection {
  folderIds: string[];
  documentIds: string[];
}

/** The document the preview overlay is showing. */
export interface PreviewTarget {
  id: string;
  name: string;
  url: string;
}

/**
 * Every modal the app can open, with whatever it needs to be opened *with*.
 * `undefined` means the modal reads everything it needs from other stores.
 *
 * Add one here, render it in `ModalProvider`.
 */
interface ModalPayloads {
  /**
   * The picker that puts a piece of selected text somewhere.
   *
   * Carries the text rather than reaching for it when it opens, because by
   * then there is nothing to reach for: clicking the button that opens this
   * collapses the selection it was made from.
   */
  "paste-into": PasteIntoTarget;
  "upload-file": undefined;
  "create-folder": undefined;
  "delete-item": DeleteTarget;
  "rename-item": RenameTarget;
  "delete-items": DeleteSelection;
  "preview-document": PreviewTarget;
  /** The Help & Support form. Reads the signed-in user for itself. */
  "help-support": undefined;
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

/**
 * The row the rename modal should edit, or `null` when it is not the modal on
 * screen. Guarded by `type` for the same reason as the delete target.
 */
export const selectRenameTarget = (state: ModalStore) =>
  state.type === "rename-item" ? (state.payload as RenameTarget) : null;

/** The ticked rows to remove, or `null` when the bulk delete is not on screen. */
export const selectDeleteSelection = (state: ModalStore) =>
  state.type === "delete-items" ? (state.payload as DeleteSelection) : null;

/** The document to preview, or `null` when the overlay is not the modal on screen. */
export const selectPreviewTarget = (state: ModalStore) =>
  state.type === "preview-document" ? (state.payload as PreviewTarget) : null;

/**
 * The text the picker should paste and where, or `null` when it is not the
 * modal on screen. Guarded by `type` like every selector above it.
 */
export const selectPasteTarget = (state: ModalStore) =>
  state.type === "paste-into" ? (state.payload as PasteIntoTarget) : null;
