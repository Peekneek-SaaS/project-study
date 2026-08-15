"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { StickyNote } from "@/features/sticky-notes/types";
import { useTRPC } from "@/trpc/client";

/**
 * Adds a note.
 *
 * Nothing is asked for first — not a colour, not a name. A sticky note that
 * needs a dialog before it exists is not a sticky note; the router picks a
 * colour at random and the note is writable the moment it lands.
 *
 * Returns the note rather than navigating, because the two callers want
 * different things afterwards: the button on the notes page is already there,
 * and the drive's create dropdown has to travel.
 */
export function useCreateNote() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const create = useMutation(trpc.stickyNote.create.mutationOptions());

  const createNote = async (): Promise<StickyNote | null> => {
    try {
      const note = await create.mutateAsync({});
      await queryClient.invalidateQueries(trpc.stickyNote.list.queryFilter());
      return note;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the note",
      );
      return null;
    }
  };

  return { createNote, isPending: create.isPending };
}
