"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoteEditor } from "@/features/sticky-notes/components/note-editor";
import type {
  NoteAppearance,
  NoteAppearancePatch,
} from "@/features/sticky-notes/lib/note-appearance";
import { noteAppearanceStyle } from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * An annotation, opened full size.
 *
 * The same sheet of paper `NoteModal` opens, and deliberately so: an annotation
 * and a sticky note are the same text in the same editor with the same
 * formatting, and a reader who learned one should not have to learn the other.
 * What it does not do is share the component — that one takes a `NoteToolbar`
 * built around a sticky note's own actions, and this one has a quote to show at
 * the top and nothing to say about pinning or duplicating.
 *
 * `formatting` is on and the density is `roomy`, which is what "all the
 * markdown features" comes down to in this editor: the bold/italic/list/link
 * bar, the heading line, and room to write more than a caption.
 */
export function AnnotationNoteModal({
  open,
  onOpenChange,
  title,
  quote,
  content,
  onChange,
  appearance,
  onAppearanceChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The words on the page this note was written against. */
  quote: string;
  content: string;
  onChange: (content: string) => void;
  appearance: NoteAppearance;
  onAppearanceChange: (patch: NoteAppearancePatch) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Painted the note's own colour edge to edge, for the reasons `NoteModal`
        sets out at length — including the one that is easy to miss: the app's
        foreground flips in dark mode and the note palette does not, so the
        whole surface is handed the note's ink to keep the close button and the
        formatting icons legible on paper that is light in every theme.
      */}
      <DialogContent
        style={{
          ...noteAppearanceStyle(appearance),
          backgroundColor: "var(--note-bg)",
          borderColor: "var(--note-edge)",
          color: "var(--note-ink)",
        }}
        className={cn(
          /*
            A ceiling, and a column to hang it off.

            `DialogContent` is a `grid` with no height of its own, so a long
            note simply made the dialog taller until both ends ran off the
            screen — and because the dialog is centred with `-translate-y-1/2`,
            what ran off was the top as well as the bottom, taking the close
            button with it. `flex` replaces that grid (tailwind-merge settles
            the two display utilities in this file's favour), which is what lets
            the editor below claim the leftover height rather than dictate it.

            `svh` rather than `vh`: on a phone `vh` is the viewport with the
            browser chrome *retracted*, so a dialog sized in it is taller than
            the screen actually is until you scroll. The small unit is the
            always-visible height, which is the one a modal wants.
          */
          "flex max-h-[85svh] flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-2xl",
          "[&_[data-slot=dialog-close]]:hover:bg-black/5",
          "[&_[data-slot=dialog-close]]:hover:text-[color:var(--note-ink)]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/*
          The sentence the note is about, above the note itself.

          Kept out of the editable region on purpose: it is a record of what was
          on the page, not part of what the reader wrote, and an editable quote
          would quietly stop being a quote. `pr-11` leaves the dialog's own
          close button its corner.
        */}
        {/* {quote ? (
          <p className="px-5 py-3 pr-11 text-xs leading-snug italic opacity-70">
            “{quote}”
          </p>
        ) : null} */}

        {/*
          No name field. The quote above is what this note is called — a second
          box asking the reader to title a thing that already has a title is why
          every one of these came out as "Untitled note".
        */}
        {/*
          `min-h-0` is the whole of why the body scrolls rather than the dialog
          growing. A flex child's default minimum is its content, so without it
          this would refuse to shrink below the full height of the note and push
          the delete row out through the bottom of the box — the cap above would
          be set and quietly overrun. The editor's own body is already
          `flex-1 overflow-y-auto`, and its toolbar already `shrink-0`, so this
          one class is all that was missing.
        */}
        <NoteEditor
          content={content}
          onChange={onChange}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          titleField={false}
          formatting
          spacing="roomy"
          className="min-h-0 flex-1"
        />

        {/* `shrink-0`, so the row stays put while the note scrolls past it. */}
        <div className="flex shrink-0 items-center px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="ml-auto gap-1.5 hover:bg-black/5"
          >
            <Trash2 />
            Delete note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
