"use client";

import { useState } from "react";
import { Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { NoteRichText } from "@/features/sticky-notes/components/note-rich-text";
import { POPOVER_WIDTH } from "@/features/annotations/types";
import { anchorToHighlightStyle } from "@/features/annotations/lib/anchor";
import {
  PAPER_DIVIDER,
  PAPER_POPOVER,
  paperStyle,
} from "@/features/annotations/lib/paper";
import type { DocumentSelection } from "@/features/annotations/hooks/use-document-selection";
import {
  DEFAULT_NOTE_APPEARANCE,
  randomNoteColor,
  type NoteColor,
} from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * The two steps between selecting a sentence and having a note on it.
 *
 * First a single button over the selection, then — once pressed — the box to
 * write in. Two steps rather than opening straight into an editor, because
 * selecting text in a document is something people do constantly for reasons
 * that have nothing to do with notes: to keep their place, to copy a phrase, by
 * accident while scrolling. An editor that opened on every one of those would
 * be a box to dismiss dozens of times an hour, while a small button is ignorable.
 *
 * Nothing is written until the note is saved. The alternative — creating the
 * row on the first press and editing it in place — is simpler to build and
 * leaves an empty note on the page every time somebody changes their mind,
 * which on a document you are reading properly is often.
 *
 * The colour is chosen *here* rather than left to the server, and that is what
 * makes the paper honest. The row does not exist yet, so there was nothing to
 * ask for its colour — the composer came up as a grey menu and then turned into
 * an amber dot, which is two different objects as far as the eye is concerned.
 * Deciding it up front means you write on the paper the note is about to be.
 */
export function AnnotationComposer({
  selection,
  onCancel,
  onSave,
  isSaving,
}: {
  selection: DocumentSelection;
  onCancel: () => void;
  /** Given the body and the colour the paper was showing while it was written. */
  onSave: (content: string, color: NoteColor) => void;
  isSaving: boolean;
}) {
  const [writing, setWriting] = useState(false);
  const [content, setContent] = useState("");

  /*
    A colour per note, drawn once and then left alone.

    The same `randomNoteColor` a new sticky note gets, and for the same reason:
    a page carrying six marks in six colours reads as six separate thoughts,
    where six identical dots read as one repeated stamp and give the eye nothing
    to tell them apart by.

    The lazy initialiser is load-bearing, and more so here than it would be for
    a constant. `useState(randomNoteColor())` evaluates on *every* render, so
    the paper would shuffle through the palette on every keystroke while the
    note was being written. Passed as a function it is called once, on mount,
    and the note keeps whatever it came up as.
  */
  const [color] = useState<NoteColor>(randomNoteColor);

  const appearance = { ...DEFAULT_NOTE_APPEARANCE, color };

  return (
    <Popover
      open
      onOpenChange={(next) => {
        // Radix reports the outside click, the Escape key and the close button
        // through the same channel. Any of them means "not this selection".
        if (!next) onCancel();
      }}
    >
      {/*
        An invisible box the size of the selection, purely so the popover has
        something to point at.

        This is the trick that avoids hand-rolling the positioning: the anchor
        is laid out in page fractions like everything else here, so it tracks
        zoom and panel drags for free, and Radix does the flipping and shifting
        that keeps the popover on screen near the page edges.
      */}
      <PopoverAnchor asChild>
        <span
          aria-hidden
          style={anchorToHighlightStyle(selection.anchor)}
          className="pointer-events-none absolute"
        />
      </PopoverAnchor>

      <PopoverContent
        align="start"
        side="bottom"
        style={{
          ...paperStyle(appearance),
          width: writing ? POPOVER_WIDTH : undefined,
        }}
        className={cn(
          PAPER_POPOVER,
          writing ? "gap-2 p-2" : "w-auto gap-0 p-1",
        )}
        // Taking focus would collapse the selection this is describing, and on
        // the first step there is nothing here that wants focus anyway.
        onOpenAutoFocus={(event) => {
          if (!writing) event.preventDefault();
        }}
      >
        {writing ? (
          <>
            {/* <p className="border-b border-border px-3 pt-2.5 pb-2 text-[11px] leading-snug text-muted-foreground italic">
              “{selection.quote}”
            </p> */}

            {/*
              No wrapper padding. The field brings its own — a padded box around
              a padded field was twenty-four pixels of margin each side inside a
              280px popover, which left the note itself about half the width of
              the thing it was written in.

              `body`, not `content`: the editor takes the note's *body*, and the
              title line is the caller's to hold. An annotation has no title of
              its own, so the body is the whole of it.
            */}
            <NoteRichText
              body={content}
              onChange={setContent}
              className="max-h-40 min-h-16 overflow-y-auto px-2 py-1.5 text-xs leading-relaxed"
              placeholder="Write a note…"
            />

            <div
              className={cn(
                "flex items-center gap-1 border-t px-2 py-1.5",
                PAPER_DIVIDER,
              )}
            >
              {/*
                Filled in the note's own ink rather than the app's primary red.

                A red button on amber paper is the one thing in this popover
                that would still be announcing which application it came from,
                and the ink/paper inversion is both unmistakably the primary
                action and unmistakably part of the note.
              */}
              <Button
                variant="default"
                size="sm"
                onClick={() => onSave(content, color)}
                disabled={isSaving}
                // style={{
                //   backgroundColor: "var(--note-ink)",
                //   color: "var(--note-bg)",
                // }}
                className=""
              >
                Save note
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWriting(true)}
              className=""
            >
              <Square className="fill-blue-200 size-3 stroke-blue-400" />
              Annote
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Dismiss"
              onClick={onCancel}
              className="opacity-60"
            >
              <X />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
