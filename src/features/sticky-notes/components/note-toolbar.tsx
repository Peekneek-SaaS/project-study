"use client";

import { useState } from "react";
import { MoreVertical, Palette, Pen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DeleteNoteDialog } from "@/features/sticky-notes/components/delete-note-dialog";
import { NoteAppearanceControls } from "@/features/sticky-notes/components/note-appearance-controls";
import { NO_DRAG_ATTRIBUTE } from "@/features/main/lib/drive-sensors";
import type { NoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * What can be done to a note, wherever it is being looked at.
 *
 * Shared by the card and the modal — the modal is the same note at a readable
 * size, so it would be odd for it to be the one place the colours cannot be
 * changed.
 */
export function NoteToolbar({
  appearance,
  onAppearanceChange,
  onDelete,
  onEdit,
  noteTitle,
  isDeleting = false,
  className,
}: {
  appearance: NoteAppearance;
  onAppearanceChange: (patch: Partial<NoteAppearance>) => void;
  /** Called once the delete has been confirmed, never straight off the menu. */
  onDelete: () => void;
  /** Names the note in the confirmation — see `noteDisplayTitle`. */
  noteTitle: string;
  /** Keeps the dialog's buttons quiet while the delete is in flight. */
  isDeleting?: boolean;
  /**
   * Write on the note where it sits. Absent in the modal, which is already an
   * editor and has nothing to switch into.
   */
  onEdit?: () => void;
  className?: string;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      {...{ [NO_DRAG_ATTRIBUTE]: "" }}
      className={cn("flex items-center text-muted", className)}
      // The toolbar sits on a note that answers its own clicks — selecting on
      // one, opening on two. A click on a button here is about the button.
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {/*
        Editing in place used to be the card's double-click. Selection wants
        that gesture now — it is what a click means everywhere else in the app —
        so the note keeps the ability and gives up the shortcut.
      */}
      {onEdit && (
        <Button
          // variant="ghost"
          size="icon-xs"
          aria-label="Write on this note"
          style={{ color: "var(--note-ink)" }}
          onClick={onEdit}
          className={cn("hover:bg-primary/90")}
        >
          <Pen className="text-muted " />
        </Button>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            // variant="ghost"
            size="icon-xs"
            aria-label="Change how this note looks"
            style={{ color: "var(--note-ink)" }}
            className={cn("hover:bg-primary/70")}
          >
            <Palette className="text-muted" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          {/* The same controls the settings modal will use — this one is
              pointed at a note, that one will be pointed at the defaults. */}
          <NoteAppearanceControls
            value={appearance}
            onChange={onAppearanceChange}
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            // variant="ghost"
            size="icon-xs"
            aria-label="Note actions"
            style={{ color: "var(--note-ink)" }}
            className={cn("hover:bg-primary/90")}
          >
            <MoreVertical className="text-muted " />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-36">
          {/*
            Asks rather than does. A note has no undo and no trash to fish it
            back out of, and this item sits one slip away from a palette the
            user opens all the time — the same reason a board and a file are
            both confirmed before they go.
          */}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingDelete(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        Rendered here rather than by each caller, so the card and the modal
        cannot end up with different answers to "does deleting ask first?".
        Radix portals it out of this toolbar, so the note underneath never sees
        its clicks.
      */}
      <DeleteNoteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
        noteTitle={noteTitle}
        isDeleting={isDeleting}
      />
    </div>
  );
}
