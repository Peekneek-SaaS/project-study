"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";

import { NoteCard } from "@/features/sticky-notes/components/note-card";
import { NoteCreateButton } from "@/features/sticky-notes/components/note-create-button";
import { useNoteTarget } from "@/features/sticky-notes/hooks/use-note-target";
import { groupNotesByDay } from "@/features/sticky-notes/lib/group-notes-by-day";
import { useTRPC } from "@/trpc/client";

/**
 * The wall of notes, cut into the days they were written on.
 *
 * Three across, and the same three across at every group — a note's place on
 * the wall is meant to be a thing you can remember, which it stops being if the
 * columns move between one heading and the next.
 */
export function NotesGrid() {
  const trpc = useTRPC();
  const { data: notes } = useSuspenseQuery(trpc.stickyNote.list.queryOptions());

  const groups = groupNotesByDay(notes);
  const flashingId = useNoteTarget();

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <NotebookPen className="size-8 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No notes yet</p>
          <p className="text-sm text-muted-foreground">
            Jot something down — notes are grouped by the day you write them.
          </p>
        </div>
        <NoteCreateButton label="Write your first note" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </h2>
            <span className="text-xs text-muted-foreground/60">
              {group.notes.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4  lg:grid-cols-3">
            {group.notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isFlashing={note.id === flashingId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
