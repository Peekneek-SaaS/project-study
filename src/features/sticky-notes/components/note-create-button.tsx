"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCreateNote } from "@/features/sticky-notes/hooks/use-create-note";

/** The notes page's way in. What it does lives in `useCreateNote`. */
export function NoteCreateButton({
  label = "New note",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const { createNote, isPending } = useCreateNote();

  return (
    <Button
      variant={variant}
      onClick={() => void createNote()}
      disabled={isPending}
    >
      <PlusIcon />
      {isPending ? "Adding…" : label}
    </Button>
  );
}
