"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Shapes,
  StickyNote,
  X,
} from "lucide-react";
import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";

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
import { DocumentChatPanel } from "@/features/chat/components/document-chat-panel";
import { DRIVE_PATH } from "@/features/main/types";
import { DocumentPip } from "@/features/work/components/document-pip";
import { WorkBuildingState } from "@/features/work/components/work-building-state";
import { WorkDocumentPanel } from "@/features/work/components/work-document-panel";
import { WorkNotesPanel } from "@/features/work/components/work-notes-panel";
import { useDocumentWorkspace } from "@/features/work/hooks/use-document-workspace";
import { useWorkLayout } from "@/features/work/hooks/use-work-layout";
import {
  DEFAULT_SPLIT,
  savePanelSplit,
  splitToLayout,
} from "@/features/work/lib/panel-split";
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
/** The panel ids the saved split is keyed by — see `splitToLayout`. */
const DOCUMENT_PANEL = "work-document";
const SECTIONS_PANEL = "work-sections";

export function WorkWorkspace({
  documentId,
  savedSplit,
}: {
  documentId: string;
  /**
   * Where this document's handle was last left, as the document panel's share
   * of the group, or `null` for one that has never been dragged. Read from a
   * cookie on the server so the first paint is already the right size — see
   * `work-view`.
   */
  savedSplit: number | null;
}) {
  const { workspace, isBuilding, hasFailed, retry, isRetrying } =
    useDocumentWorkspace(documentId);

  const layout = useWorkLayout();

  /**
   * The page a chat citation asked for, if this page was opened from one.
   *
   * In the query string rather than in a store, because a citation is a *link* —
   * it has to survive being opened in a new tab, shared, or reloaded, and none
   * of that works if the target page lives in memory. `nuqs` reads it
   * reactively, so following a second citation to the same document scrolls the
   * viewer rather than doing nothing on an unchanged route.
   */
  const [citedPage] = useQueryState("page", parseAsInteger);

  /**
   * A citation has to be able to *show* the page it lands on.
   *
   * The layout is remembered across visits, so someone who reads with the
   * document minimised — or closed altogether, working from the board — would
   * follow a citation into a page where the document is not on screen at all.
   * The link would appear to do nothing.
   *
   * So arriving with a page restores the document, once, and only when a page
   * was actually asked for. A visit without one leaves the arrangement exactly
   * as the user left it.
   */
  useEffect(() => {
    if (citedPage === null) return;
    layout.showDocument();
    // Only on a change of the *cited page*: depending on the layout would rerun
    // this every time the user then minimised the document, undoing them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citedPage]);

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

  // A split only means something with two panels to split between. With one on
  // screen it fills the group on its own, and handing the group a layout naming
  // a panel that is not rendered is a saved size waiting to be misapplied.
  const hasBothPanels = showDocumentPanel && layout.sectionsOpen;

  const defaultLayout = useMemo(
    () =>
      hasBothPanels
        ? splitToLayout(
            savedSplit ?? DEFAULT_SPLIT,
            DOCUMENT_PANEL,
            SECTIONS_PANEL,
          )
        : undefined,
    [hasBothPanels, savedSplit],
  );

  /**
   * Remembers the split, once the drag is over.
   *
   * `onLayoutChanged` rather than `onLayoutChange`: the latter fires on every
   * pointer move, which would rewrite the cookie a hundred times across one
   * drag. `isUserInteraction` is what separates a drag from the layout the
   * library recomputes on mount, on a constraint change, or when a panel opens
   * and closes — saving those would overwrite a deliberate split with an
   * incidental one.
   */
  const handleLayoutChanged = useCallback(
    (next: Record<string, number>, meta: { isUserInteraction: boolean }) => {
      if (!meta.isUserInteraction) return;

      const documentGrow = next[DOCUMENT_PANEL];
      const sectionsGrow = next[SECTIONS_PANEL];
      if (
        typeof documentGrow !== "number" ||
        typeof sectionsGrow !== "number"
      ) {
        return;
      }

      // Normalised rather than taken at face value: these are flex-grow values,
      // and what is worth keeping is their ratio, not the scale they arrived on.
      const total = documentGrow + sectionsGrow;
      if (total <= 0) return;

      savePanelSplit(documentId, documentGrow / total);
    },
    [documentId],
  );

  /**
   * The sections themselves, with no toolbar of their own.
   *
   * The tabs that used to sit above these now live in the page header — see the
   * return below. What is left here is only the panes, so this is a plain stack
   * rather than a `Tabs` root: the root moved up to wrap the header *and* the
   * panels, because a `TabsList` and its `TabsContent` have to share one.
   */
  const sections = (
    <div className="flex h-full min-h-0 flex-col">
      {/*
        Board and notes stay mounted. The board is an Excalidraw canvas that
        reads its scene once on mount, so unmounting it to look at a note and
        coming back would reload the whole scene and lose the viewport the user
        had set up.
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

      {/*
        The one tab that is *not* force-mounted.

        The other two are kept alive because unmounting them loses something the
        user set up — the canvas viewport, a note being edited. A chat has the
        opposite property: its transcript is on the server, and mounting it
        starts a poll while the document is being read. Mounting it on every work
        page whether or not anyone opens it would mean that poll running behind
        a board nobody has left.

        It is also the only panel whose state does not need to survive tab
        switches, because there is nothing local to survive: `useChat` is seeded
        from the stored conversation, which is refetched on the way back in.
      */}
      <TabsContent value="chat" className="min-h-0 flex-1">
        <QueryErrorBoundary message="Something went wrong loading this chat.">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <DocumentChatPanel documentId={documentId} />
          </Suspense>
        </QueryErrorBoundary>
      </TabsContent>
    </div>
  );

  /**
   * Pressing a tab both selects it and makes sure it is on screen.
   *
   * `showSections` rather than `setTab`, because with the tabs now in the page
   * header they are reachable while the sections panel is closed — and a tab
   * that highlights without bringing its content back is a control that appears
   * broken. Opening a panel that is already open is a no-op, so this is right in
   * both cases.
   */
  const openTab = useCallback(
    (value: string) => {
      if (isWorkTab(value)) layout.showSections(value);
    },
    [layout],
  );

  return (
    /*
      The `Tabs` root wraps the whole workspace rather than just the sections
      panel, which is what lets the triggers live in the header while their
      panes stay down in the panel — they share one Radix context and nothing
      else has to be wired between them.
    */
    <Tabs
      value={layout.tab}
      onValueChange={openTab}
      className="min-h-0 flex-1 gap-0"
    >
      {/*
        One toolbar for the page instead of two stacked strips.

        The tabs used to sit inside the sections panel, directly under this bar,
        which cost a row of height to say something this bar had room for and
        left the two disagreeing about width as the split was dragged. Up here
        they are always in the same place whatever the panels are doing — and
        they still work when the sections panel is shut, which is the part that
        makes closing it worth doing.

        `@container` so the labels answer to the *page* width. They used to
        answer to the panel's, which is why they were hidden far more often than
        they needed to be.
      */}
      <div className="@container flex h-11 shrink-0 justify-between items-center gap-2 border-b px-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={DRIVE_PATH}>
              <ArrowLeft />
            </Link>
          </Button>

          <span
            className="hidden min-w-0 truncate text-sm font-medium @md:block"
            title={workspace.name}
          >
            {workspace.name}
          </span>
        </div>

        {/*
          Centred rather than trailing the name: the tabs are the thing this bar
          is *for* now, and a long file name would otherwise push them around as
          it truncated.
        */}
        <div>
          <TabsList variant="custom" className="mx-auto">
            {/*
            Brings the document back, however it left — minimised into the
            floating window, or closed outright. One button for both because
            `showDocument` settles both flags, and because from the user's side
            it is one intent: put the document back.
            
            Sat with the tabs since it is the same kind of control — which pane
            am I looking at — and shown only when the document is not already
            on screen.
            */}
            {(layout.minimized || !layout.documentOpen) && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Show the document"
                onClick={layout.showDocument}
                className="hover:bg-transparent"
              >
                <FileText className="fill-orange-400 stroke-orange-200" />
                <span className="hidden @lg:inline">Document</span>
              </Button>
            )}

            {/*
            `aria-label` on every trigger rather than relying on the text: below
            the threshold the label is `hidden`, which takes it out of the
            accessibility tree as well as off the screen, leaving a tab with an
            icon and no name.
            
            `onClick` alongside the root's `onValueChange` because that callback
            says nothing when the tab pressed is already the current one — which
            is exactly the press that still has to reopen a closed panel.
            */}
            <TabsTrigger
              value="board"
              aria-label="Board"
              onClick={() => openTab("board")}
            >
              <Shapes className="stroke-purple-500 fill-purple-500" />
              <span className="hidden @lg:inline">Board</span>
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              aria-label="Sticky notes"
              onClick={() => openTab("notes")}
            >
              <StickyNote className="fill-yellow-400 stroke-yellow-200" />
              <span className="hidden @lg:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              aria-label="Chat"
              onClick={() => openTab("chat")}
            >
              <MessageSquare className="fill-emerald-500 stroke-emerald-500" />
              <span className="hidden @lg:inline">Chat</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* `relative` is what the floating window is positioned against — it
          measures and parks itself within its offset parent. */}
      <div className="relative min-h-0 flex-1">
        <ResizablePanelGroup
          orientation={orientation}
          // No `defaultSize` on the panels below: with a remembered split this
          // would be a second opinion about the same thing, and the two would
          // disagree on the first render after a drag.
          defaultLayout={defaultLayout}
          onLayoutChanged={handleLayoutChanged}
        >
          {showDocumentPanel && (
            <>
              <ResizablePanel
                id={DOCUMENT_PANEL}
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
                  page={citedPage}
                  // Minimising and closing both need somewhere for the page to
                  // carry on being: with the sections closed this panel is all
                  // there is, so neither is offered.
                  //
                  // No tabs passed any more — the panel used to carry a copy of
                  // them for when the sections were closed, and the header's
                  // are always there now.
                  onMinimize={layout.sectionsOpen ? layout.minimize : undefined}
                  onClose={
                    layout.sectionsOpen
                      ? () => layout.setDocumentOpen(false)
                      : undefined
                  }
                />
              </ResizablePanel>
              {layout.sectionsOpen && <ResizableHandle withHandle />}
            </>
          )}

          {layout.sectionsOpen && (
            <ResizablePanel
              id={SECTIONS_PANEL}
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
            page={citedPage}
            corner={layout.corner}
            size={layout.pipSize}
            onCornerChange={layout.setCorner}
            onSizeChange={layout.setPipSize}
            onRestore={layout.restore}
            // The window only shows while the sections panel is open, so
            // closing the document can never leave the page with no panel.
            onClose={() => layout.setDocumentOpen(false)}
          />
        )}
      </div>
    </Tabs>
  );
}
