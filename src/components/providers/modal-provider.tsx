"use client";

import { CreateFolderModal } from "@/features/main/modal/create-folder-modal";
import { DeleteModal } from "@/features/main/modal/delete-modal";
import { DocumentPreviewModal } from "@/features/main/modal/document-preview-modal";
import { UploadModal } from "@/features/main/modal/upload-modal";

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
      <DeleteModal />
      <DocumentPreviewModal />
    </>
  );
}
