"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";

/**
 * Confirms deleting one note.
 *
 * Presentational, unlike `DeleteBoardDialog`, which owns its own mutation: a
 * note is already deleted through `useNoteMutations`, which the card holds so
 * it can dim itself while the delete is in flight. Two callers reaching for
 * that hook would be two mutations for one note.
 */
export function DeleteNoteDialog({
  open,
  onOpenChange,
  onConfirm,
  noteTitle,
  isDeleting = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** The note's first line, or "Untitled note" — see `noteDisplayTitle`. */
  noteTitle: string;
  isDeleting?: boolean;
}) {
  // Held past closing so the name stays in the copy while the dialog animates
  // out — by then the note it names is gone. Same reason as the board dialogs.
  const [lastTitle, setLastTitle] = useState(noteTitle);
  if (open && noteTitle !== lastTitle) setLastTitle(noteTitle);

  const handleOpenChange = (next: boolean) => {
    if (next || isDeleting) return;
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={`Delete ${lastTitle}?`}
      description="The note and everything written on it are removed. This cannot be undone."
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isDeleting}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}
