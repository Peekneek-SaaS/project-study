"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoteEditor } from "@/features/sticky-notes/components/note-editor";
import { NoteToolbar } from "@/features/sticky-notes/components/note-toolbar";
import type {
  NoteAppearance,
  NoteAppearancePatch,
} from "@/features/sticky-notes/lib/note-appearance";
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
  onAppearanceChange: (patch: NoteAppearancePatch) => void;
  onDelete: () => void;
}) {
  /**
   * Whether the appearance controls are on show.
   *
   * Closed each time the note is opened, on purpose: how a note looks is
   * decided once and then left alone, while what it says is why the note was
   * opened. Reopening with the bar full of selects would put five controls
   * between the reader and the first line every time.
   */
  const [isCustomising, setIsCustomising] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        The note, at the size it is actually read at.

        One surface, edge to edge: the paper runs behind the heading, the action
        row and the controls, so nothing in here is a different colour from the
        note it belongs to. What stays the app's is the *controls* — the selects
        and the buttons on the bar are this app's, because a control is a
        control wherever it is standing.

        `backgroundColor`, never the `background` shorthand: it would reset
        `background-image` and take the ruled lines with it. See `NoteRichText`.

        `color` matters more than it looks, and it is what dark mode turns on.
        The note palette has no dark block — deliberately, see the tokens: a
        sticky note is the colour it was written on, so amber at midnight is
        amber. But the app's foreground *does* flip, and everything in this
        dialog that does not name a colour inherits it — the close button, the
        formatting icons — so in dark mode they came out white, on paper that is
        light in every theme. Handing the whole surface the note's own ink fixes
        each of them at once, and fixes any control added later by default.
      */}
      <DialogContent
        style={{
          ...noteAppearanceStyle(appearance),
          backgroundColor: "var(--note-bg)",
          borderColor: "var(--note-edge)",
          color: "var(--note-ink)",
        }}
        className={cn(
          "gap-0 overflow-hidden p-0 sm:max-w-2xl rounded-none",
          /*
            The close button is the dialog's, not this file's — the only way to
            reach it is its `data-slot`. At rest it inherits the ink above; on
            hover the ghost variant would give it `bg-muted` and
            `text-foreground`, which in dark mode is a dark chip with a white X
            sitting on light paper. Kept on the paper's own terms instead.
          */
          "[&_[data-slot=dialog-close]]:hover:bg-black/5",
          "[&_[data-slot=dialog-close]]:hover:text-[color:var(--note-ink)]",
        )}
      >
        {/* The name is already the first line of the note, and editable there.
            The dialog still needs one for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{noteDisplayTitle(content)}</DialogTitle>
        </DialogHeader>

        {/*
          On the close button's own line, rather than in a strip above it.

          The X is `absolute top-2 right-2` at `size-6`, so its centre is 20px
          down. `h-10` with centred items puts these there too — measured off
          that rule rather than nudged with padding until it looked right, so
          the two stay level if either grows. `pr-11` leaves the corner clear:
          the button reaches 8px in from the right and is 24px wide.

          Back on the paper, so back to the note's own ink — the colour these
          icons sit on is the one the ink was chosen to be read against.
        */}
        <NoteToolbar
          onDelete={onDelete}
          noteTitle={noteDisplayTitle(content)}
          onCustomise={() => setIsCustomising((showing) => !showing)}
          isCustomising={isCustomising}
          className="h-10 shrink-0 items-center justify-end gap-1 px-3 pr-11"
        />

        {/*
          `formatting` only here. The modal is where a note is written at
          length, so it is the one place worth spending a row of buttons on —
          the card is a thumbnail, and the same row over it would be most of
          the note.
        */}
        <NoteEditor
          content={content}
          onChange={onChange}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          /*
            The whole bar rides on the pen — the formatting buttons as well as
            the appearance controls, since both are things you reach for
            deliberately rather than read.

            Gated here rather than by withholding `onAppearanceChange`: that
            trick hid the appearance half by taking away the handler it reports
            to, which stops working the moment the *other* half has to go too.
            One flag, one row, and the editor still draws each group only when
            it has something to drive it.
          */
          formatting={isCustomising}
          // Room to write: a heading-sized name, a bar of its own for the
          // controls, and a margin for the body — the note itself is unchanged,
          // it just is not a 14rem thumbnail here.
          spacing="roomy"
          className="h-[60svh]"
        />
      </DialogContent>
    </Dialog>
  );
}
