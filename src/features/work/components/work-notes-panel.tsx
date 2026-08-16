"use client";

import { useEffect, useMemo } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Plus, StickyNote as StickyNoteIcon } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NoteCard } from "@/features/sticky-notes/components/note-card";
import { groupNotesByDay } from "@/features/sticky-notes/lib/group-notes-by-day";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { useRowSelection } from "@/hooks/use-row-selection";
import { listContainer, mountAnimation } from "@/lib/motion";
import { useNoteSelectionStore } from "@/lib/stores/note-selection-store";
import { useTRPC } from "@/trpc/client";

/**
 * The notes taken against one document.
 *
 * The wall's arrangement without the wall's chrome: same cards, same grouping
 * by the day a note was written, but no filter toolbar and no bulk selection
 * bar. Those belong to a page whose whole job is notes; this is one tab of a
 * page whose job is a document, and a second toolbar inside a panel inside a
 * page is one frame too many.
 *
 * Two across rather than the wall's three: this panel is half a screen at most,
 * and often much less once the document has taken its share.
 */
export function WorkNotesPanel({ documentId }: { documentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: notes } = useSuspenseQuery(
    trpc.stickyNote.listForDocument.queryOptions({ documentId }),
  );

  const clearSelection = useNoteSelectionStore((state) => state.clear);

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
  const { selectRow } = useRowSelection(rows, useNoteSelectionStore);

  const groups = groupNotesByDay(notes);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div> */}

      <div
        className="min-h-0 flex-1 overflow-y-auto p-3"
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
                <div className="flex items-baseline gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs  font-medium tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </h2>
                    <span className="text-xs tabular-nums text-white bg-sidebar-primary px-1 py-0.5">
                      {group.notes.length}
                    </span>
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

                <motion.div
                  {...mountAnimation}
                  variants={listContainer}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
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
    </div>
  );
}
