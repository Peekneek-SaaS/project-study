"use client";

import { useState } from "react";
import { MoreVertical, Pen, PenLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteNoteDialog } from "@/features/sticky-notes/components/delete-note-dialog";
import { NO_DRAG_ATTRIBUTE } from "@/features/main/lib/drive-sensors";
import { cn } from "@/lib/utils";

/**
 * What can be *done* to a note, wherever it is being looked at.
 *
 * Deliberately only that: opening it for writing, and deleting it. How a note
 * looks used to be here too, and is not any more — a palette on every card put
 * a control for choosing colours on the wall, over the notes it was for, when
 * the place anybody actually adjusts a note is the one where they are reading
 * it at full size. Those controls live in the modal's formatting bar now, next
 * to the bold and the lists, which is where the rest of "how this note reads"
 * already was.
 */
export function NoteToolbar({
  onDelete,
  /**
   * Which surface this row is sitting on.
   *
   * `note` is the card, where the buttons are over the paper and take its ink.
   * `app` is the modal, where they are on the dialog's own chrome — and where
   * the note's ink would be wrong twice over: it is a colour chosen to read
   * against the paper, and the paper is not what is behind them there.
   */
  tone = "note",
  onEdit,
  /**
   * Show or hide the note's whole editing bar — formatting and appearance both.
   *
   * Absent on the card, which has no bar to reveal. In the modal it is the pen,
   * and the argument for hiding it is the same for both halves: they are things
   * you reach for deliberately, a few times, and then stop thinking about,
   * while the note itself is what you came to read. Out of the way, the dialog
   * opens on the words.
   */
  onCustomise,
  isCustomising = false,
  noteTitle,
  isDeleting = false,
  className,
}: {
  tone?: "note" | "app";
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
  onCustomise?: () => void;
  isCustomising?: boolean;
  className?: string;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      {...{ [NO_DRAG_ATTRIBUTE]: "" }}
      className={cn(
        "flex items-center",
        tone === "app" ? "text-muted-foreground" : "text-muted",
        className,
      )}
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
          variant="note"
          size="icon-xs"
          aria-label="Write on this note"
          style={tone === "note" ? { color: "var(--note-ink)" } : undefined}
          onClick={onEdit}
          className={cn("")}
        >
          <Pen className="" />
        </Button>
      )}

      {/* Before the dots and the close, so the three read left to right as
          "change how this looks", "do something to it", "leave". */}
      {onCustomise && (
        <Button
          variant="note"
          size="icon-xs"
          // Named for what a press does rather than for where you are: "Edit"
          // on a bar that is already open says nothing about what the button
          // is for.
          aria-label={isCustomising ? "Hide editing tools" : "Edit this note"}
          aria-pressed={isCustomising}
          title={isCustomising ? "Hide editing tools" : "Edit this note"}
          style={tone === "note" ? { color: "var(--note-ink)" } : undefined}
          // The bar it opens sits over a field with a live selection — pressing
          // this must not take the caret with it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCustomise}
          className={cn(isCustomising && "border-primary")}
        >
          <PenLine />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="note"
            size="icon-xs"
            aria-label="Note actions"
            style={{ color: "var(--note-ink)" }}
            className={cn("")}
          >
            <MoreVertical className="" />
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
