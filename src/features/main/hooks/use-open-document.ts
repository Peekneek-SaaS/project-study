"use client";

import { useCallback } from "react";

import type { DriveDocument } from "@/features/main/types";
import { isPdf } from "@/lib/document-file-types";
import { useModalStore } from "@/lib/stores/modal-store";

/**
 * Opening a document, from wherever it is asked for — the row, the play
 * button, the row menu — so the three cannot drift apart.
 *
 * PDFs get the in-app preview. Word and PowerPoint have no viewer here, so
 * those are handed to the browser.
 */
export function useOpenDocument() {
  const openModal = useModalStore((state) => state.open);

  return useCallback(
    (doc: DriveDocument) => {
      if (doc.status !== "READY") return;

      if (isPdf(doc.name)) {
        openModal("preview-document", {
          id: doc.id,
          name: doc.name,
          url: doc.pdfUrl,
        });
        return;
      }

      window.open(doc.pdfUrl, "_blank", "noopener,noreferrer");
    },
    [openModal],
  );
}
