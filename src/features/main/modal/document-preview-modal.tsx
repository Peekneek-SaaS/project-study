"use client";

import { useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LazyPdfViewer } from "@/features/main/components/lazy-pdf-viewer";
import { documentPreviewPath } from "@/lib/document-links";
import { selectPreviewTarget, useModalStore } from "@/lib/stores/modal-store";

/**
 * Full-bleed PDF preview.
 *
 * Deliberately not built on `Modal`: this is not a dialog with a document
 * inside it, it is the document itself, so the only chrome is a thin bar for
 * the name and the way out.
 */
export function DocumentPreviewModal() {
  const target = useModalStore(selectPreviewTarget);
  const closeModal = useModalStore((state) => state.close);

  // Held past close so the overlay can animate out with its content intact.
  const [lastTarget, setLastTarget] = useState(target);
  if (target && target !== lastTarget) setLastTarget(target);
  const item = target ?? lastTarget;

  if (!item) return null;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="flex min-w-0 items-center gap-2 border-b px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <DialogTitle className="min-w-0 flex-1 truncate font-medium">
            {item.name}
          </DialogTitle>
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={documentPreviewPath(item.id)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${item.name} on its own page`}
            >
              <ExternalLink />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closeModal}
            aria-label="Close preview"
          >
            <X />
          </Button>
        </div>

        <DialogDescription className="sr-only">
          Preview of {item.name}. Scroll to move through the pages.
        </DialogDescription>

        <div className="min-h-0 flex-1 bg-muted/40">
          <LazyPdfViewer url={item.url} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
