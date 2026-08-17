"use client";

import {
  ExternalLink,
  FileText,
  MessageSquare,
  Minimize2,
  Minus,
  PanelRight,
  Shapes,
  StickyNote,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentView } from "@/features/main/components/document-view";
import type { PdfLayout } from "@/features/main/components/pdf-viewer";
import {
  DEFAULT_WORK_TAB,
  isWorkTab,
  type WorkTab,
} from "@/features/work/types";
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
  tab = DEFAULT_WORK_TAB,
  onShowSections,
  pdfLayout = "vertical",
  className,
}: {
  documentId: string;
  name: string;
  /** Drawn for the floating window: a shorter bar, no file name. */
  compact?: boolean;
  onMinimize?: () => void;
  onClose?: () => void;
  /**
   * Which section the panel would come back on — the one the user was last
   * looking at. Only marks a tab as the current one; opening is `onShowSections`.
   *
   * Defaulted rather than required so a caller that shows no tabs at all — the
   * floating window — has nothing to say about them.
   */
  tab?: WorkTab;
  /**
   * Brings the board and notes back on the section asked for, and is passed
   * *only* when they are closed — at which point this panel is the whole page,
   * and the tabs that would otherwise switch between them went with them.
   *
   * The mirror of the sections bar's "Show document": each panel is what offers
   * the other, so whichever one is left standing always has a way back. The tabs
   * are the sections panel's own, so reopening lands where it was aimed rather
   * than wherever the panel was left.
   */
  onShowSections?: (tab: WorkTab) => void;
  /**
   * Which way the pages run. Passed down rather than decided here, because the
   * thing that decides it is the panel arrangement — pages run across when the
   * panels are stacked and this one is a wide, short strip.
   */
  pdfLayout?: PdfLayout;
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
  const hasControls = Boolean(onShowSections || onMinimize || onClose);

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

          {/*
            The sections panel's own tabs, standing in for it while it is closed:
            the same control in the same place, so reopening the board is one
            press on the board tab rather than a press to open and another to
            switch.

            `activationMode="manual"` because activating a tab here opens a
            panel — arrowing along the row to look at the options should not keep
            doing that. `onClick` alongside `onValueChange` for the same reason
            the two are not interchangeable here: `onValueChange` says nothing
            when the tab pressed is already the current one, which is exactly the
            press that has to still open the panel.
          */}
          {onShowSections && (
            <Tabs
              value={tab}
              activationMode="manual"
              onValueChange={(value) => {
                if (isWorkTab(value)) onShowSections(value);
              }}
            >
              <TabsList variant="custom">
                <TabsTrigger
                  value="board"
                  aria-label="Board"
                  onClick={() => onShowSections("board")}
                >
                  <Shapes className="stroke-purple-500 fill-purple-500" />
                  <span className="hidden @sm:inline">Board</span>
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  aria-label="Sticky notes"
                  onClick={() => onShowSections("notes")}
                >
                  <StickyNote className="fill-yellow-400 stroke-yellow-200" />
                  <span className="hidden @sm:inline">Sticky notes</span>
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  aria-label="Chat"
                  onClick={() => onShowSections("chat")}
                >
                  <MessageSquare className="fill-emerald-500 stroke-emerald-500" />
                  <span className="hidden @sm:inline">Chat</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

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
