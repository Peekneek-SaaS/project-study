"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoteEditor } from "@/features/sticky-notes/components/note-editor";
import { NoteToolbar } from "@/features/sticky-notes/components/note-toolbar";
import type { NoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { noteAppearanceStyle } from "@/features/sticky-notes/lib/note-appearance";
import { noteDisplayTitle } from "@/features/sticky-notes/lib/note-content";
import { cn } from "@/lib/utils";

/**
 * One note, opened.
 *
 * The card is a thumbnail — fixed and small on purpose — so this is where a
 * note is actually read and written at length. Editable throughout: a click
 * lands in the text and types, with none of the card's read-only gate, because
 * asking for the note *is* asking to work on it.
 *
 * Content is not owned here. The card holds it and passes it through, so the
 * two views of the same note cannot drift apart while both are on screen.
 */
export function NoteModal({
  open,
  onOpenChange,
  content,
  onChange,
  appearance,
  onAppearanceChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onChange: (content: string) => void;
  appearance: NoteAppearance;
  onAppearanceChange: (patch: Partial<NoteAppearance>) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          ...noteAppearanceStyle(appearance),
          background: "var(--note-bg)",
          borderColor: "var(--note-edge)",
        }}
        className={cn(
          // `p-0` and a bigger cap: the note fills the dialog rather than
          // sitting in it, so it reads as the same object the card showed.
          "gap-0 overflow-hidden p-0 sm:max-w-2xl",
        )}
      >
        {/* The name is already the first line of the note, and editable there.
            The dialog still needs one for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{noteDisplayTitle(content)}</DialogTitle>
        </DialogHeader>

        {/* Right-padded past the dialog's own close button. */}
        <NoteToolbar
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          onDelete={onDelete}
          noteTitle={noteDisplayTitle(content)}
          className="shrink-0 justify-end px-1.5 py-1 pr-11"
        />

        <NoteEditor
          content={content}
          onChange={onChange}
          appearance={appearance}
          className="h-[60svh] pb-2"
        />
      </DialogContent>
    </Dialog>
  );
}
