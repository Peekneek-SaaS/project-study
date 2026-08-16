"use client";

import { ExternalLink, FileText, Minimize2, PanelRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LazyPdfViewer } from "@/features/main/components/lazy-pdf-viewer";
import { isPdf } from "@/lib/document-file-types";
import { documentFilePath } from "@/lib/document-links";
import { cn } from "@/lib/utils";

/**
 * The document itself, in whichever frame is holding it.
 *
 * The same component fills the left panel and the floating window, because they
 * are the same thing at two sizes — one viewer, so a page turned in the panel is
 * not forgotten when it is minimised, and so the two cannot drift apart in what
 * they can display. `compact` is the only difference: the floating window has no
 * room for a name and a full set of buttons above it.
 */
export function WorkDocumentPanel({
  documentId,
  name,
  compact = false,
  onMinimize,
  onClose,
  onShowSections,
  className,
}: {
  documentId: string;
  name: string;
  /** Drawn for the floating window: a shorter bar, no file name. */
  compact?: boolean;
  onMinimize?: () => void;
  onClose?: () => void;
  /**
   * Brings the board and notes back, and is passed *only* when they are
   * closed — at which point this panel is the whole page, and the button that
   * would otherwise reopen them went with them.
   *
   * The mirror of the sections bar's "Show document": each panel is what offers
   * the other, so whichever one is left standing always has a way back.
   */
  onShowSections?: () => void;
  className?: string;
}) {
  const url = documentFilePath(documentId);
  const readable = isPdf(name);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b px-2",
          compact ? "h-8" : "h-10 px-3",
        )}
      >
        {/* {!compact && (
          <>
            <FileText className="size-4 shrink-0 text-orange-400" />
            <span className="truncate text-sm font-medium" title={name}>
              {name}
            </span>
          </>
        )} */}

        {/* Pushes the buttons right in both bars — in the compact one this is
            the whole of the bar, which doubles as the drag handle's target. */}
        <div className="ml-auto flex items-center gap-1">
          {onShowSections && (
            <Button size="sm" variant="ghost" onClick={onShowSections}>
              <PanelRight />
              Board &amp; notes
            </Button>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Open in a new tab"
            asChild
          >
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink />
            </a>
          </Button>

          {onMinimize && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Minimize the document"
              onClick={onMinimize}
            >
              <Minimize2 />
            </Button>
          )}

          {onClose && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Close the document panel"
              onClick={onClose}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {readable ? (
          <LazyPdfViewer url={url} />
        ) : (
          /*
            Word and PowerPoint have no viewer in this app. The panel says so
            and offers the browser rather than being left out of the page
            entirely: the board and the notes beside it are the point of a work
            page, and they are just as useful for a deck as for a PDF.
          */
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                This file can&apos;t be previewed here
              </p>
              <p className="text-xs text-muted-foreground">
                Your board and notes are still on the right.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open in a new tab
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
