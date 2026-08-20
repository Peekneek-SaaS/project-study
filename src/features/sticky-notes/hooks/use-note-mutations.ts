"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { NoteAppearancePatch } from "@/features/sticky-notes/lib/note-appearance";
import type { StickyNote } from "@/features/sticky-notes/types";
import { useTRPC } from "@/trpc/client";

/** Long enough to cover a sentence, short enough that a closed tab keeps it. */
const CONTENT_DEBOUNCE_MS = 800;

/**
 * Writing a note back, in the two rhythms it actually changes in.
 *
 * Typing is continuous and cheap to lose a moment of, so it is debounced and
 * never invalidates: the textarea already holds the newest text, and refetching
 * the list mid-sentence would only invite the server's older copy to argue with
 * it. Appearance is a single deliberate click, so it is written immediately and
 * painted optimistically — a colour that waits for a round trip feels broken.
 *
 * `documentId` says which list the note is *in*, and every cache write below
 * goes through it. A note on a document's work page lives under
 * `listForDocument`, and painting a colour into `list` instead would optimistic
 * -update a query the note is not in: the click would appear to do nothing
 * until a refetch, and the wall of standalone notes would briefly hold a note
 * that does not belong to it.
 */
export function useNoteMutations(noteId: string, documentId?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const update = useMutation(trpc.stickyNote.update.mutationOptions());
  const remove = useMutation(trpc.stickyNote.remove.mutationOptions());

  const timer = useRef<number | null>(null);
  const pending = useRef<string | null>(null);

  const updateRef = useRef(update.mutateAsync);
  useEffect(() => {
    updateRef.current = update.mutateAsync;
  });

  /*
    Whichever list this note is in — as a *filter*, and never as a single key.

    `list` is cached per set of filters: the wall reads it with whatever the
    toolbar is asking for, so its key holds `{ modified, q, … }`. An optimistic
    write aimed at `list.queryKey()` with no input is therefore aimed at a
    different cache entry than the one on screen — it landed in an entry nobody
    was rendering, the note did not move, and the change only appeared once a
    refetch replaced the visible entry from the server. Which is exactly what
    "it changes when I refresh" is.

    A filter matches every variant, so the paint reaches the one being looked at
    whatever the wall is currently filtered to.
  */
  const listFilter = documentId
    ? trpc.stickyNote.listForDocument.queryFilter({ documentId })
    : trpc.stickyNote.list.queryFilter();

  const flushContent = async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const content = pending.current;
    if (content === null) return;
    pending.current = null;

    try {
      await updateRef.current({ id: noteId, content });
    } catch (error) {
      // Put it back, so the next keystroke's debounce carries it again rather
      // than the text living only in a textarea the user may be about to close.
      pending.current ??= content;
      toast.error(
        error instanceof Error ? error.message : "Could not save the note",
      );
    }
  };

  const saveContent = (content: string) => {
    pending.current = content;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => void flushContent(),
      CONTENT_DEBOUNCE_MS,
    );
  };

  // Closing the page mid-debounce would otherwise drop the last sentence.
  // Written in an effect rather than during the render that reads it: a render
  // can be thrown away, and this one is about what to do after the last.
  const flushRef = useRef(flushContent);
  useEffect(() => {
    flushRef.current = flushContent;
  });
  useEffect(() => {
    return () => {
      void flushRef.current();
    };
  }, []);

  const patchAppearance = async (patch: NoteAppearancePatch) => {
    // Painted first: the cached list is what the grid renders from, so writing
    // through it is what makes the colour land on the click rather than on the
    // response. Every cached variant, for the reason on `listFilter`.
    const previous = queryClient.getQueriesData<StickyNote[]>(listFilter);
    queryClient.setQueriesData<StickyNote[]>(listFilter, (notes) =>
      notes?.map((note) => (note.id === noteId ? { ...note, ...patch } : note)),
    );

    try {
      await update.mutateAsync({ id: noteId, ...patch });
    } catch (error) {
      // Straight back to what it was — an optimistic paint that failed is worse
      // than one that never happened, because it looks saved. Each variant is
      // restored to its own snapshot rather than to a shared one.
      for (const [key, notes] of previous) {
        queryClient.setQueryData(key, notes);
      }
      toast.error(
        error instanceof Error ? error.message : "Could not update the note",
      );
    }
  };

  const removeNote = async () => {
    try {
      await remove.mutateAsync({ id: noteId });
      await queryClient.invalidateQueries(listFilter);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the note",
      );
    }
  };

  return {
    saveContent,
    patchAppearance,
    removeNote,
    isRemoving: remove.isPending,
    /**
     * Whether a keystroke is still waiting on the debounce.
     *
     * Read by the card before it accepts a newer copy of the note from the
     * server: between the last keystroke and the flush there is a window where
     * the database is *behind* what is on screen, and adopting its answer then
     * would type the user's sentence backwards.
     *
     * A function rather than a value because it is asked during a render and
     * must not cause one — the answer lives in a ref, and nothing re-renders
     * when it changes.
     */
    hasPendingContent: () => pending.current !== null,
  };
}
