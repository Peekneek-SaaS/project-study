"use client";

import { BulkDeleteModal } from "@/features/main/modal/bulk-delete-modal";
import { CreateFolderModal } from "@/features/main/modal/create-folder-modal";
import { CreateTodoModal } from "@/features/main/modal/create-todo-modal";
import { DeleteModal } from "@/features/main/modal/delete-modal";
import { DeleteTodosModal } from "@/features/main/modal/delete-todos-modal";
import { DocumentPreviewModal } from "@/features/main/modal/document-preview-modal";
import { RenameItemModal } from "@/features/main/modal/rename-item-modal";
import { SearchModal } from "@/features/main/modal/search-modal";
import { SettingsModal } from "@/features/main/modal/settings-modal";
import { UploadModal } from "@/features/main/modal/upload-modal";
import { PasteIntoModal } from "@/features/main/modal/paste-into-modal";
import { SupportModal } from "@/features/main/modal/support-modal";

/**
 * Mounts every modal once, at the root, so anything on the page can open one
 * through `useModalStore` without rendering a trigger beside it — and so an
 * upload survives the button (or the row) that started it unmounting.
 *
 * Each modal reads its own open state and renders nothing while closed.
 */
export function ModalProvider() {
  return (
    <>
      <UploadModal />
      <CreateFolderModal />
      <CreateTodoModal />
      <RenameItemModal />
      <DeleteModal />
      <BulkDeleteModal />
      <DeleteTodosModal />
      <DocumentPreviewModal />
      {/* Reads `useSearchStore` rather than `useModalStore` — see that store. */}
      <SearchModal />
      {/* And this one `useSettingsStore`, for the reasons written there. */}
      <SettingsModal />
      <PasteIntoModal />
      <SupportModal />
    </>
  );
}
