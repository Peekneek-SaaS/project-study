"use client";

import { ExternalLink, FileText, Minus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DocumentView } from "@/features/main/components/document-view";
import type { PdfLayout } from "@/features/main/components/pdf-viewer";
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
  pdfLayout = "vertical",
  page,
  pageRequestId,
  className,
}: {
  documentId: string;
  name: string;
  /** Drawn for the floating window: a shorter bar, no file name. */
  compact?: boolean;
  onMinimize?: () => void;
  onClose?: () => void;
  /**
   * Which way the pages run. Passed down rather than decided here, because the
   * thing that decides it is the panel arrangement — pages run across when the
   * panels are stacked and this one is a wide, short strip.
   */
  pdfLayout?: PdfLayout;
  /** A page to open at, when a chat citation asked for one. */
  page?: number | null;
  /** Lets the same page be asked for twice — see `PdfViewer`. */
  pageRequestId?: number;
  className?: string;
}) {
  const url = documentFilePath(documentId);

  /**
   * Whether the bar has anything to hold.
   *
   * With the name and icon commented out below, the button group is all that is
   * left in it — and the floating window passes none of those callbacks, because
   * its own title bar already carries the name and the restore button. Rendering
   * the bar regardless left an empty strip of dead height between that title bar
   * and the top of the document.
   *
   * Asked as a question about the content rather than about `compact`, so a
   * caller that passes no controls never gets a bar, whichever size it is in.
   */
  const hasControls = Boolean(onMinimize || onClose);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      {hasControls && (
        <div
          className={cn(
            // As short as the buttons in it allow: every row this bar takes is a
            // row the document does not get.
            //
            // `@container` for the same reason the sections bar has one — the
            // tab labels below answer to this panel's width, which a `md:` could
            // not see: dragging the panel narrow does not change the window.
            "@container flex shrink-0 items-center mt-2 gap-2 px-1",
            compact ? "h-8" : "h-9 px-2",
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

          <div className="ml-auto flex items-center gap-1">

            {onMinimize && (
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
            )}

            {onMinimize && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Minimize the document"
                onClick={onMinimize}
              >
                <Minus />
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
      )}

      <div className="min-h-0 flex-1">
        <DocumentView
          name={name}
          url={url}
          pdfLayout={pdfLayout}
          page={page}
          pageRequestId={pageRequestId}
          // The work page is where a document is *worked on*, so this is where
          // notes may be written into it. The preview overlay deliberately does
          // not pass it: that surface is for looking, and a reader skimming a
          // file from the drive is not annotating it.
          documentId={documentId}
          fallback={
            /*
              Only the pre-2007 binary formats reach this now — `.doc` and
              `.ppt`, which are not readable by the Word and PowerPoint viewers
              (see `documentViewerKind`). The panel says so and offers the
              browser rather than being left out of the page entirely: the board
              and the notes beside it are the point of a work page, and they are
              just as useful for a deck as for a PDF.
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
          }
        />
      </div>
    </div>
  );
}
