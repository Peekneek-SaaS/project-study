"use client";

import { useTransition } from "react";
import { NotebookPen, SearchXIcon } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { NoteCreateButton } from "@/features/sticky-notes/components/note-create-button";
import { noteFilterParsers } from "@/features/sticky-notes/lib/params";

/** Nothing to show, and which of the two reasons that is. */
export function NotesEmptyState({ isFiltering }: { isFiltering: boolean }) {
  // In a transition for the same reason the toolbar's setter is: clearing the
  // filter refetches the wall, and this button sits inside the boundary that
  // would otherwise blank out under it. See `notes-filter-view`.
  const [, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(noteFilterParsers, {
    history: "replace",
    startTransition,
  });

  // A filtered-away wall is not an empty one, and offering to write a note
  // there answers a question nobody asked — the way out is the filter.
  if (isFiltering) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No notes match this filter</EmptyTitle>
          <EmptyDescription>
            Nothing was edited in that window. Try a wider one, or clear it to
            see every note.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            onClick={() => setFilters({ modified: null })}
          >
            Clear filter
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotebookPen />
        </EmptyMedia>
        <EmptyTitle>No notes yet</EmptyTitle>
        <EmptyDescription>
          Jot something down — notes are grouped by the day you write them.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <NoteCreateButton label="Write your first note" />
      </EmptyContent>
    </Empty>
  );
}
