"use client";

import { Suspense } from "react";
import {
  ArrowLeft,
  Columns2,
  FileText,
  PanelRight,
  Shapes,
  StickyNote,
} from "lucide-react";
import Link from "next/link";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BoardDynamic from "@/features/board/components/board-dynamic";
import { DRIVE_PATH } from "@/features/main/types";
import { DocumentPip } from "@/features/work/components/document-pip";
import { WorkBuildingState } from "@/features/work/components/work-building-state";
import { WorkDocumentPanel } from "@/features/work/components/work-document-panel";
import { WorkNotesPanel } from "@/features/work/components/work-notes-panel";
import { useDocumentWorkspace } from "@/features/work/hooks/use-document-workspace";
import { useWorkLayout } from "@/features/work/hooks/use-work-layout";
import { isWorkTab } from "@/features/work/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * A document and the workspace built around it.
 *
 * Two panels: the document on the left, its board and notes on the right. Both
 * can be resized against each other and either can be closed outright — but
 * never both, or the page would be an empty frame with no way back into it. The
 * document can also be minimised rather than closed, which drops it into a
 * floating window over the sections so the canvas gets the full width without
 * the document leaving the page.
 *
 * The floating window is rendered as a sibling of the panel group rather than
 * inside a panel, so it can be positioned against the whole workspace and is
 * not clipped by whichever panel happens to be under it.
 */
export function WorkWorkspace({ documentId }: { documentId: string }) {
  const { workspace, isBuilding, hasFailed, retry, isRetrying } =
    useDocumentWorkspace(documentId);

  const layout = useWorkLayout();

  /**
   * Side by side on a desktop, stacked on a phone.
   *
   * Two panels split across a narrow screen leave neither of them wide enough
   * to be anything — a canvas you cannot draw on next to a page you cannot
   * read. Stacked, each gets the full width and gives up height instead, which
   * is the cheaper thing to lose.
   *
   * `useIsMobile` reports false until its effect runs, so a phone renders the
   * side-by-side split for one frame and corrects it on hydration. That is the
   * same guess the header makes, and it costs a reflow rather than a wrong
   * layout that sticks.
   */
  const isMobile = useIsMobile();
  const orientation = isMobile ? "vertical" : "horizontal";

  // The floating window replaces the document panel rather than sitting beside
  // it, whichever way round the two are.
  const showDocumentPanel = layout.documentOpen && !layout.minimized;
  const showPip =
    layout.documentOpen && layout.minimized && layout.sectionsOpen;

  const sections = (
    <Tabs
      value={layout.tab}
      onValueChange={(value) => {
        if (isWorkTab(value)) layout.setTab(value);
      }}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      {/*
        `@container` so the labels below answer to this panel's width rather
        than the window's. `md:` could not see a panel dragged narrow — the
        window has not changed size — so the labels stayed put and the toolbar
        crushed. The same fix the notes grid needed.
      */}
      <div className="@container flex h-10 shrink-0 items-center gap-2 px-2">
        <TabsList>
          {/*
            `aria-label` on the trigger rather than relying on the text: below
            the threshold the label is `hidden`, which takes it out of the
            accessibility tree as well as off the screen, leaving a tab with an
            icon and no name. The attribute is carried at every width so the two
            cannot disagree.
          */}
          <TabsTrigger value="board" aria-label="Board">
            <Shapes className="stroke-purple-500" />
            <span className="hidden @sm:inline">Board</span>
          </TabsTrigger>
          <TabsTrigger value="notes" aria-label="Sticky notes">
            <StickyNote className=" stroke-yellow-500" />
            <span className="hidden @sm:inline">Sticky notes</span>
          </TabsTrigger>
        </TabsList>

        <div className="ml-auto flex items-center gap-1">
          {/* Restores the document without having to find the floating window,
              which may be parked behind whatever the user is working on. */}
          {layout.minimized && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Show the document"
              onClick={layout.restore}
            >
              <FileText className="text-orange-500" />
              <span className="hidden @sm:inline">Document</span>
            </Button>
          )}
          {!layout.documentOpen && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Show the document"
              onClick={() => layout.setDocumentOpen(true)}
            >
              <FileText className="text-orange-500" />
              <span className="hidden @sm:inline">Document</span>
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Close the sections panel"
            title="Close this panel"
            // Refused when it would empty the page — the hook guards this too,
            // but a button that cannot work should look like it.
            disabled={!layout.documentOpen || layout.minimized}
            onClick={() => layout.setSectionsOpen(false)}
          >
            <PanelRight />
          </Button>
        </div>
      </div>

      {/*
        Both tabs stay mounted. The board is an Excalidraw canvas that reads its
        scene once on mount, so unmounting it to look at a note and coming back
        would reload the whole scene and lose the viewport the user had set up.
      */}
      <TabsContent
        value="board"
        className="min-h-0 flex-1"
        forceMount
        hidden={layout.tab !== "board"}
      >
        {isBuilding || hasFailed || workspace.boardId === null ? (
          <WorkBuildingState
            status={workspace.status}
            onRetry={retry}
            isRetrying={isRetrying}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <BoardDynamic boardId={workspace.boardId} />
          </div>
        )}
      </TabsContent>

      <TabsContent
        value="notes"
        className="min-h-0 flex-1"
        forceMount
        hidden={layout.tab !== "notes"}
      >
        {isBuilding || hasFailed ? (
          <WorkBuildingState
            status={workspace.status}
            onRetry={retry}
            isRetrying={isRetrying}
          />
        ) : (
          <QueryErrorBoundary message="Something went wrong loading these notes.">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <WorkNotesPanel documentId={documentId} />
            </Suspense>
          </QueryErrorBoundary>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button size="sm" variant="ghost" asChild>
          <Link href={DRIVE_PATH}>
            <ArrowLeft />
            Back
          </Link>
        </Button>
        <span className="truncate text-sm font-medium" title={workspace.name}>
          {workspace.name}
        </span>
      </div> */}

      {/* `relative` is what the floating window is positioned against — it
          measures and parks itself within its offset parent. */}
      <div className="relative min-h-0 flex-1">
        <ResizablePanelGroup orientation={orientation}>
          {showDocumentPanel && (
            <>
              <ResizablePanel
                id="work-document"
                defaultSize="50"
                minSize="20"
                // `overflow-hidden` so a panel's contents can never decide the
                // panel's size. Whatever is inside scrolls itself or is clipped;
                // neither one is allowed to push the group taller and drag the
                // other panel along with it.
                className="min-h-0 overflow-hidden"
              >
                <WorkDocumentPanel
                  documentId={documentId}
                  name={workspace.name}
                  // Stacked, this panel is a wide strip: pages run across it
                  // rather than down, so a page fits its height instead of
                  // being cropped to a sliver of one.
                  pdfLayout={isMobile ? "horizontal" : "vertical"}
                  // Minimising and closing both need somewhere for the page to
                  // carry on being: with the sections closed this panel is all
                  // there is, so neither is offered and the way back to them
                  // takes their place.
                  onMinimize={layout.sectionsOpen ? layout.minimize : undefined}
                  onClose={
                    layout.sectionsOpen
                      ? () => layout.setDocumentOpen(false)
                      : undefined
                  }
                  onShowSections={
                    layout.sectionsOpen
                      ? undefined
                      : () => layout.setSectionsOpen(true)
                  }
                />
              </ResizablePanel>
              {layout.sectionsOpen && <ResizableHandle withHandle />}
            </>
          )}

          {layout.sectionsOpen && (
            <ResizablePanel
              id="work-sections"
              defaultSize="50"
              minSize="25"
              // As above, and this is the panel it matters for: the notes list
              // is the one thing here with no natural ceiling on its height.
              className={cn("min-h-0 overflow-hidden")}
            >
              {sections}
            </ResizablePanel>
          )}
        </ResizablePanelGroup>

        {showPip && (
          <DocumentPip
            documentId={documentId}
            name={workspace.name}
            corner={layout.corner}
            onCornerChange={layout.setCorner}
            onRestore={layout.restore}
          />
        )}
      </div>
    </div>
  );
}
