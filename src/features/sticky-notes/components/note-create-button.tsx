"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

/**
 * Adds a note.
 *
 * Nothing is asked for first — not a colour, not a title. A sticky note that
 * needs a dialog before it exists is not a sticky note; the router picks a
 * colour at random and the note is editable the moment it lands.
 */
export function NoteCreateButton({
  label = "New note",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const create = useMutation(trpc.stickyNote.create.mutationOptions());

  const handleCreate = async () => {
    try {
      await create.mutateAsync({});
      await queryClient.invalidateQueries(trpc.stickyNote.list.queryFilter());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the note",
      );
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleCreate}
      disabled={create.isPending}
    >
      <PlusIcon />
      {create.isPending ? "Adding…" : label}
    </Button>
  );
}
