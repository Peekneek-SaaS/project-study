"use client";

import { useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteNotesDialog } from "@/features/sticky-notes/components/delete-notes-dialog";
import { NoteCard } from "@/features/sticky-notes/components/note-card";
import { NotesEmptyState } from "@/features/sticky-notes/components/notes-empty-state";
import NotesFilterView from "@/features/sticky-notes/components/notes-filter-view";
import { useNotesBrowser } from "@/features/sticky-notes/hooks/use-notes-browser";
import { useNoteTarget } from "@/features/sticky-notes/hooks/use-note-target";
import { groupNotesByDay } from "@/features/sticky-notes/lib/group-notes-by-day";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useNoteSelectionStore } from "@/lib/stores/note-selection-store";
import { cn } from "@/lib/utils";

/**
 * The wall of notes, cut into the days they were written on.
 *
 * Three across, and the same three across at every group — a note's place on
 * the wall is meant to be a thing you can remember, which it stops being if the
 * columns move between one heading and the next.
 *
 * Selection runs over the flat list rather than the groups, so a shift-click
 * takes a range straight through a day heading: the groups are a way of drawing
 * the wall, not a way of dividing it.
 */
export function NotesGrid() {
  const { notes, isFiltering } = useNotesBrowser();

  const selectedIds = useNoteSelectionStore((state) => state.ids);
  const clearSelection = useNoteSelectionStore((state) => state.clear);

  const [deletingMany, setDeletingMany] = useState<string[] | null>(null);

  const groups = groupNotesByDay(notes);
  const flashingId = useNoteTarget();

  // Opening a note is the card's own business — it owns the modal — so there is
  // nothing for the keyboard's Enter to call here. It still walks the wall and
  // ticks as it goes.
  const rows = useMemo(
    () => notes.map((note) => ({ id: note.id, open: () => {} })),
    [notes],
  );
  const { selectRow, selectAll } = useRowSelection(rows, useNoteSelectionStore);

  // What is on screen decides. Notes can go out from under a selection —
  // deleted from their own toolbar, filtered away — and reading the ticks back
  // off the wall keeps a stale id out of the count and off the request.
  const selected = notes
    .filter((note) => selectedIds.has(note.id))
    .map((note) => note.id);

  const isSelecting = selected.length > 0;
  const allSelected = notes.length > 0 && selected.length === notes.length;

  // The selection bar stays mounted through its own fade-out, so it needs
  // something to say on the way out — reading the live count there would flash
  // "0 notes selected" across the fade.
  const [shownCount, setShownCount] = useState(selected.length);
  if (isSelecting && shownCount !== selected.length)
    setShownCount(selected.length);

  return (
    <>
      {/*
        Both bars share one grid cell and cross-fade in place, and the whole
        thing sticks under the title bar — the drive's arrangement, and the
        reasoning behind every part of it is written out in `main-content.tsx`.
      */}
      <div className="sticky top-[calc(var(--drive-sticky-top)+var(--drive-title-h))] z-20 -mx-4 grid h-(--drive-toolbar-h) grid-cols-1 grid-rows-1 bg-background px-4 *:col-start-1 *:row-start-1">
        <div
          inert={isSelecting}
          className={cn(
            "transition-[opacity,visibility] duration-150 ease-out",
            isSelecting && "invisible opacity-0",
          )}
        >
          <NotesFilterView />
        </div>

        <div
          inert={!isSelecting}
          className={cn(
            "flex w-full items-center justify-between gap-3 bg-input/30 px-3 py-2",
            "transition-[opacity,visibility] duration-150 ease-out",
            !isSelecting && "invisible opacity-0",
          )}
        >
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X />
            </Button>
            {/* `tabular-nums` so counting up does not shuffle everything to
              the right of the number by a fraction of a character. */}
            <span className="text-sm tabular-nums">
              {shownCount} {shownCount === 1 ? "note" : "notes"} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              inert={allSelected}
              className={cn(allSelected && "invisible")}
            >
              Select all
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeletingMany(selected)}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <div
        // `flex-1` carries the view's leftover height down to the empty state,
        // which centres itself in it.
        className="flex flex-1 flex-col gap-8 pt-2"
        // Clicking past the notes drops the selection, the way clicking empty
        // space in a file manager does. Cards answer their own clicks; buttons
        // and menus speak for themselves. Anything else here is background.
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
          <NotesEmptyState isFiltering={isFiltering} />
        ) : (
          groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h2>
                <span className="text-xs bg-primary py-1 px-2 text-muted dark:text-white tabular-nums">
                  {group.notes.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4  lg:grid-cols-3">
                {group.notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isFlashing={note.id === flashingId}
                    onSelect={selectRow}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <DeleteNotesDialog
        ids={deletingMany}
        onClose={() => setDeletingMany(null)}
      />
    </>
  );
}
