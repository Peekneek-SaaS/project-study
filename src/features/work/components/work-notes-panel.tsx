"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Plus, StickyNote as StickyNoteIcon, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DeleteNotesDialog } from "@/features/sticky-notes/components/delete-notes-dialog";
import { NoteCard } from "@/features/sticky-notes/components/note-card";
import { groupNotesByDay } from "@/features/sticky-notes/lib/group-notes-by-day";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { useRowSelection } from "@/hooks/use-row-selection";
import { listContainer, mountAnimation } from "@/lib/motion";
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
 */
export function WorkNotesPanel({ documentId }: { documentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: notes } = useSuspenseQuery(
    trpc.stickyNote.listForDocument.queryOptions({ documentId }),
  );

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
          trpc.stickyNote.listForDocument.queryFilter({ documentId }),
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
    // `relative` is what the selection bar below is pinned to. `@container`
    // is for the bar's own labels — the scroller has one too, and the nearest
    // wins, so the grid inside still measures against the scroller's content
    // box and keeps the thresholds it was tuned for.
    <div className="@container relative flex h-full min-h-0 flex-col">
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
          "border-b bg-background/95 px-3 py-1.5 backdrop-blur",
          "transition-[opacity,visibility] duration-150 ease-out",
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
        className="@container min-h-0 flex-1 overflow-y-auto p-3"
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
              <Plus />
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
                    "sticky top-0 z-10 -mx-3 bg-background px-3 py-1.5",
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
                    <Plus />
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
      </div>

      {/*
        Asks before it deletes, and it is the wall's own dialog — so a bulk
        delete started here and one started there cannot end up with different
        wording, or with one of them forgetting to clear the ticks afterwards.
        It invalidates the whole `stickyNote` path, which covers this
        document's list as well as the wall's.
      */}
      <DeleteNotesDialog
        ids={deletingMany}
        onClose={() => setDeletingMany(null)}
      />
    </div>
  );
}
