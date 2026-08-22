"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import {
  Highlighter,
  Plus,
  Square,
  StickyNote,
  StickyNote as StickyNoteIcon,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { parseAsInteger, useQueryState } from "nuqs";
import { toast } from "sonner";

import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnotationNotesSection } from "@/features/annotations/components/annotation-notes-section";
import { useDocumentAnnotations } from "@/features/annotations/hooks/use-annotations";
import { useWorkLayout } from "@/features/work/hooks/use-work-layout";
import type { NotesTab } from "@/features/work/types";
import { DeleteNotesDialog } from "@/features/sticky-notes/components/delete-notes-dialog";
import { NoteCard } from "@/features/sticky-notes/components/note-card";
import { groupNotesByDay } from "@/features/sticky-notes/lib/group-notes-by-day";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { useRowSelection } from "@/hooks/use-row-selection";
import { listContainer, mountAnimation } from "@/lib/motion";
import { infiniteOptions } from "@/lib/pagination";
import { useNoteSelectionStore } from "@/lib/stores/note-selection-store";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * The notes taken against one document.
 *
 * The wall's arrangement without the wall's chrome: same cards, same grouping
 * by the day a note was written, and the same click-to-select and
 * shift-to-range, but no filter toolbar. Filters belong to a page whose whole
 * job is notes; this is one tab of a page whose job is a document, and there is
 * nothing here to narrow.
 *
 * Selection *is* here, because a note that can be made in this panel has to be
 * removable from it — the alternative is deleting them one at a time, or going
 * to a wall these notes do not appear on. The bar it puts up is laid over the
 * list rather than added above it; see below for why that matters.
 *
 * The notes written *into* the document get a tab of their own beside the loose
 * ones. They were stacked in one scroller to begin with, and two lists with
 * different headings — days above, pages below — in one column read as one
 * confused list. A tab is the honest shape: they are two collections that
 * happen to be about the same document, and you are looking for one or the
 * other, never both at once.
 *
 * Everything below about selection, the bar and the bulk delete belongs to the
 * sticky notes alone, which is why all of it lives inside that tab. The
 * annotations are read here and edited in their own modal.
 */
export function WorkNotesPanel({ documentId }: { documentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.stickyNote.listForDocument.infiniteQueryOptions(
        { documentId },
        infiniteOptions,
      ),
    );

  // Flattened once per fetch rather than per render — it feeds the memo that
  // builds the keyboard's row map, and a fresh array each render rebuilds it.
  const notes = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  /*
    How many notes there *are*, which is not how many are loaded.

    The tab badge is the reason this comes off the server rather than off
    `notes.length`: a count that climbed as you scrolled would be reporting the
    scroll position rather than the document. Read off the newest page, because
    every page carries the count as of when it was fetched and the last one
    fetched is the least stale.
  */
  const totalNotes = data.pages[data.pages.length - 1]?.total ?? notes.length;

  // Shared with the marker layer in the viewer through the query cache, so the
  // count here and the dots on the page cannot disagree.
  const { annotations } = useDocumentAnnotations(documentId);

  /*
    The same query key the document panel reads to decide which page to open at.

    `nuqs` keys are global to the URL, so setting it here reaches the viewer
    without a callback threaded down through the workspace — and it is the same
    channel a chat citation uses, which means "go to page" behaves identically
    whether the reader arrived from a note or from an answer.
  */
  const [, setPage] = useQueryState("page", parseAsInteger);

  /*
    Two things off the layout store: how to open the document, and which of the
    two lists below was open last.

    `showDocument` exists for exactly this and says so: a citation that lands on
    page 5 of a document the reader had closed or minimised appears to do
    nothing at all. "Go to page" from a note is the same request arriving by a
    different door, and it was doing the same nothing — the query key changed,
    the viewer that reads it was not on screen to hear about it.

    `notesTab` is remembered rather than held in `useState` here, because state
    in this component does not survive what routinely happens to it: the panel
    unmounts whenever the reader switches to the board or the chat, whenever the
    sections panel is closed, and on every reload. Somebody working through a
    document's annotations came back to the sticky notes each time. Kept in the
    same record as the outer work tab, so the two are remembered the same way
    and two windows on the same document agree — see `useWorkLayout`.
  */
  const { showDocument, notesTab, setNotesTab } = useWorkLayout();

  const goToPage = (pageNumber: number) => {
    showDocument();
    void setPage(pageNumber);
  };

  const clearSelection = useNoteSelectionStore((state) => state.clear);
  const selectedIds = useNoteSelectionStore((state) => state.ids);

  const [deletingMany, setDeletingMany] = useState<string[] | null>(null);

  // The selection store is shared with the notes wall, so a page arrived at
  // with notes still ticked elsewhere would open showing a selection that is
  // not about anything here. Cleared on the way in and on the way out.
  useEffect(() => {
    clearSelection();
    return clearSelection;
  }, [clearSelection]);

  const create = useMutation(
    trpc.stickyNote.create.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          // The infinite variant, not `queryFilter`: an infinite query's key
          // carries `type: "infinite"`, and a plain query filter does not match
          // it — so the list would be left holding the page it had before the
          // new note was written.
          trpc.stickyNote.listForDocument.infiniteQueryFilter({ documentId }),
        ),
      onError: (error) => toast.error(error.message),
    }),
  );

  // Opening is the card's own business, as on the wall — it owns its modal — so
  // there is nothing for the keyboard's Enter to call.
  const rows = useMemo(
    () => notes.map((note) => ({ id: note.id, open: () => {} })),
    [notes],
  );
  const { selectRow, selectAll } = useRowSelection(rows, useNoteSelectionStore);

  const groups = groupNotesByDay(notes);

  // Read back off what is on screen, as the wall does. A note can leave the
  // list from its own toolbar while still being ticked, and a stale id would
  // otherwise ride along into the count and into the delete request.
  const selected = notes
    .filter((note) => selectedIds.has(note.id))
    .map((note) => note.id);

  const isSelecting = selected.length > 0;
  const allSelected = notes.length > 0 && selected.length === notes.length;

  // The bar stays mounted through its own fade-out, so it needs something to
  // say on the way out — reading the live count there would flash "0 notes
  // selected" across the fade.
  const [shownCount, setShownCount] = useState(selected.length);
  if (isSelecting && shownCount !== selected.length) {
    setShownCount(selected.length);
  }

  return (
    <Tabs
      value={notesTab}
      onValueChange={(next) => setNotesTab(next as NotesTab)}
      className="@container flex h-full min-h-0 flex-col gap-0"
    >
      <TabsList className="mx-3 mt-2 shrink-0 self-start bg-input/30 dark:bg-muted">
        <TabsTrigger value="notes" className="gap-1.5">
          <StickyNoteIcon className="size-3.5 fill-yellow-400 stroke-yellow-200" />
          Notes
          {totalNotes > 0 ? (
            <span className="tabular-nums opacity-60">{totalNotes}</span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="annotations" className="gap-1.5">
          <Square className="size-3 fill-primary stroke-primary" />
          Annotations
          {annotations.length > 0 ? (
            <span className="tabular-nums opacity-60">
              {annotations.length}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      {/*
        `relative` is what the selection bar below is pinned to — and it is on
        this tab rather than on the panel, because the bar belongs to the sticky
        notes alone. Pinned to the panel it would have hung over the annotations
        tab too, offering to bulk-delete a selection that tab cannot make.
      */}
      <TabsContent
        value="notes"
        className="relative flex min-h-0 flex-1 flex-col"
      >
        {/* <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div> */}

        {/*
        The selection bar, laid *over* the top of the list rather than inserted
        above it.

        That is the whole of why nothing flicks. A bar that takes up space has
        to push the notes down when it appears and let them snap back when it
        goes, and no amount of animation hides the reflow underneath. Sitting on
        top, it costs the layout nothing and can simply fade — and because the
        day headings are pinned to this same edge, what it covers is whichever
        heading is currently at the top, so it reads as that row changing rather
        than as a new thing arriving.

        Kept mounted and hidden rather than unmounted, so the fade has something
        to fade. `inert` is what stops the hidden copy from taking clicks or a
        tab stop while it is invisible.
      */}
        <div
          inert={!isSelecting}
          className={cn(
            "absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2",
            // `h-10` to the pixel, matching the day heading it covers — see
            // there. Border-box sizing means the border is inside that height,
            // so the two boxes are exactly the same size rather than the border
            // making this one a pixel taller.
            "h-10 border-b px-3",
            // Opaque, not a translucent blur. The heading underneath is the
            // thing this is standing in for, so showing a ghost of it through
            // the bar reads as a bug rather than as depth.
            "bg-background",
            "transition-[opacity,visibility] duration-250 ease-out",
            !isSelecting && "invisible opacity-0",
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear the selection"
              onClick={clearSelection}
            >
              <X />
            </Button>
            {/* `tabular-nums` so counting up does not shuffle everything to the
              right of the number by a fraction of a character. */}
            <span className="truncate text-xs tabular-nums">
              {shownCount} selected
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              // Still rendered when everything is already ticked, so the Delete
              // button beside it does not slide sideways as the last note is
              // added to the selection.
              inert={allSelected}
              className={cn(allSelected && "invisible")}
            >
              Select all
            </Button>
            <Button
              variant="destructive"
              size="sm"
              aria-label="Delete the selected notes"
              onClick={() => setDeletingMany(selected)}
            >
              <Trash2 />
              <span className="hidden @xs:inline">Delete</span>
            </Button>
          </div>
        </div>

        <div
          // `@container` is the whole fix for the grid below. A note card is a
          // fixed height with no minimum width, so two of them in a panel dragged
          // down to 250px are a pair of slivers — and viewport breakpoints cannot
          // see that, because resizing a panel does not resize the window. This
          // makes the panel itself the thing the columns are measured against.
          // `pb-3` and `px-3`, deliberately no `pt`. Top padding here is a strip
          // above the pinned day heading: it leaves a gap between the tabs bar
          // and the heading, and it pushes the heading down far enough that its
          // bottom edge shows below the selection bar laid over it. With no top
          // padding the heading starts and pins flush, and both go away.
          className="@container min-h-0 flex-1 overflow-y-auto px-3 pb-3"
          // Clicking past the notes drops the selection, as on the wall.
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest(`[${ROW_ATTRIBUTE}], button, a, [role='menuitem']`)
            )
              return;
            clearSelection();
          }}
        >
          {groups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <StickyNoteIcon className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No notes on this document</p>
                <p className="text-xs text-muted-foreground">
                  Anything you write here stays with it.
                </p>
              </div>
              <Button
                size="sm"
                disabled={create.isPending}
                onClick={() => create.mutate({ documentId })}
              >
                <StickyNote />
                New note
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-3">
                  <div
                    className={cn(
                      // Pinned to the top of the scroll area, so the day a note
                      // was written stays legible while its notes scroll past.
                      // `-mx-3 px-3` widens the background back out over the
                      // scroller's padding, so cards pass *under* the heading
                      // rather than beside it.
                      //
                      // `h-10` is not decoration: it is the same height as the
                      // selection bar, which is laid over this exact spot. Sized
                      // by its contents instead, the two drift by a pixel or two
                      // and this heading shows below the bar covering it.
                      "sticky top-0 z-10 -mx-3 h-10 bg-background px-3",
                      "flex items-center justify-between gap-2",
                    )}
                  >
                    {/* `min-w-0` so the day label is what gives way when the
                      panel narrows — without it a flex item refuses to shrink
                      below its text and pushes the button off the edge. */}
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {group.label}
                      </h2>
                      <span className="shrink-0 bg-sidebar-primary px-1 py-0.5 text-xs tabular-nums text-white">
                        {group.notes.length}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      // Carried whether or not the label is showing — below the
                      // threshold this is a bare plus, and a button with no
                      // accessible name is not one.
                      aria-label="New note"
                      disabled={create.isPending}
                      onClick={() => create.mutate({ documentId })}
                    >
                      <StickyNote />
                      {/* The label goes before the button does. Narrow enough and
                        this is a plus on its own, which is still the same
                        button in the same place. */}
                      <span className="hidden @xs:inline">New note</span>
                    </Button>
                  </div>

                  <motion.div
                    {...mountAnimation}
                    variants={listContainer}
                    /*
                    `@`-prefixed, so these are the *panel's* width and not the
                    window's. The thresholds are picked backwards from the card
                    rather than from round numbers: each step lands a note at
                    roughly 220–250px across, which is about where one stops
                    reading as a note and starts reading as a column of text.

                    Three is the ceiling on purpose — it is what a panel with
                    the document closed comes to, and it matches the wall's own
                    three so a note does not change shape between the two.
                  */
                    className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3"
                  >
                    {group.notes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onSelect={selectRow}
                        // What ties every edit made here back to this document's
                        // list rather than to the wall's — see `useNoteMutations`.
                        documentId={documentId}
                      />
                    ))}
                  </motion.div>
                </section>
              ))}
            </div>
          )}

          {/*
            Inside the scroller rather than after it, unlike the full-page
            lists: this panel's scrollport is that `overflow-y-auto` div and not
            the page, so a sentinel placed outside it would sit in a box that
            never scrolls and would either fire once at mount or never at all.
          */}
          {groups.length > 0 && (
            <InfiniteScrollSentinel
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              label="Loading more notes"
            />
          )}
        </div>
      </TabsContent>

      {/*
        The same padding rules as the notes scroller above — `px-3 pb-3` and
        deliberately no `pt`, so the pinned page headings behave the way the day
        headings do. `@container` again because the cards inside measure their
        columns against the panel, not the window.
      */}
      <TabsContent
        value="annotations"
        className="@container min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        <AnnotationNotesSection documentId={documentId} onOpenPage={goToPage} />
      </TabsContent>

      {/*
        Asks before it deletes, and it is the wall's own dialog — so a bulk
        delete started here and one started there cannot end up with different
        wording, or with one of them forgetting to clear the ticks afterwards.
        It invalidates the whole `stickyNote` path, which covers this
        document's list as well as the wall's.

        Outside both tabs: a dialog that unmounted because the reader switched
        tab behind it would take its own confirmation with it.
      */}
      <DeleteNotesDialog
        ids={deletingMany}
        onClose={() => setDeletingMany(null)}
      />
    </Tabs>
  );
}
