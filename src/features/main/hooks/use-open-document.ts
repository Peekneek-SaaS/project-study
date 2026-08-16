"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import type { DriveDocument } from "@/features/main/types";
import { workPath } from "@/features/work/types";
import { isPdf } from "@/lib/document-file-types";
import { documentFilePath } from "@/lib/document-links";
import { useModalStore } from "@/lib/stores/modal-store";

/**
 * Opening a document, from wherever it is asked for — the row, the play
 * button, the row menu — so the three cannot drift apart.
 *
 * Two ways in, because they answer different questions. Opening a document now
 * means going to its work page: the document beside its board and its notes,
 * which is where anything more than a glance happens. `preview` is the glance —
 * the modal that used to be the double-click, still on the play button, for
 * checking which file this is without leaving the drive.
 *
 * Neither is offered until the document is `READY`. Before that the file exists
 * but the workspace around it does not, and a work page opened early would be
 * two empty panels — see the drive's status badge for what it says instead.
 */
export function useOpenDocument() {
  const openModal = useModalStore((state) => state.open);
  const router = useRouter();

  const open = useCallback(
    (doc: DriveDocument) => {
      if (doc.status !== "READY") return;
      router.push(workPath(doc.id));
    },
    [router],
  );

  const preview = useCallback(
    (doc: DriveDocument) => {
      if (doc.status !== "READY") return;

      if (isPdf(doc.name)) {
        openModal("preview-document", {
          id: doc.id,
          name: doc.name,
          url: documentFilePath(doc.id),
        });
        return;
      }

      // Word and PowerPoint have no viewer here, so a glance at one is the
      // browser's job.
      window.open(documentFilePath(doc.id), "_blank", "noopener,noreferrer");
    },
    [openModal],
  );

  return { open, preview };
}
