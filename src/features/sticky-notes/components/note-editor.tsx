"use client";

import { useCallback, useRef, useState } from "react";

import {
  joinNote,
  noteBody,
  noteTitleLine,
} from "@/features/sticky-notes/lib/note-content";
import {
  NoteFormatToolbar,
  noteFormatState,
  type NoteFormatState,
  type NoteInlineFormat,
  type NoteListFormat,
} from "@/features/sticky-notes/components/note-format-toolbar";
import { NoteAppearanceInline } from "@/features/sticky-notes/components/note-appearance-inline";
import { NoteColourControls } from "@/features/sticky-notes/components/note-colour-controls";
import { NoteLinkDialog } from "@/features/sticky-notes/components/note-link-dialog";
import {
  NoteRichText,
  type NoteRichTextHandle,
} from "@/features/sticky-notes/components/note-rich-text";
import type {
  NoteAppearance,
  NoteAppearancePatch,
} from "@/features/sticky-notes/lib/note-appearance";
import { NO_DRAG_ATTRIBUTE } from "@/features/main/lib/drive-sensors";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Nothing is formatted until the caret has been somewhere. */
const NO_FORMATS: NoteFormatState = {
  bold: false,
  italic: false,
  underline: false,
  bullet: false,
  ordered: false,
  link: false,
};

/**
 * A note's text, in the two fields it is written in.
 *
 * One string in the database, two fields here: the first line — the note's name
 * — gets its own plain input, and `joinNote` puts them back together on every
 * keystroke. The body is the rich field, so bold looks bold as it is typed
 * rather than being spelled out in asterisks; what it stores is described in
 * `note-html.ts`.
 *
 * Shared by the card and the modal so the note reads the same in both.
 * `readOnly` is what separates them on the grid: a card is not typed into until
 * it has been asked for, and it shows the same formatting either way — the
 * whole point of writing it this way round.
 */
export function NoteEditor({
  content,
  onChange,
  appearance,
  /**
   * How the note looks, when this surface is allowed to change it.
   *
   * Absent on the card, which shows a note rather than adjusting one — see
   * `NoteToolbar`. Present in the modal, where the palette rides on the end of
   * the formatting bar.
   */
  onAppearanceChange,
  readOnly = false,
  /**
   * Whether the formatting row is offered.
   *
   * Off on the wall, where a card is 14rem of thumbnail and a row of buttons
   * over it would be most of the note. On in the modal, which is where a note
   * is actually written at length — the same split as the two sizes themselves.
   */
  formatting = false,
  /**
   * How much room the three parts are given.
   *
   * `tight` is the card: 14rem of thumbnail, where every pixel spent on a gap
   * is a pixel of the note not shown. `roomy` is the modal, which is a sheet of
   * paper rather than a preview — the name wants to read as a heading, the
   * formatting row wants to be a band of its own, and the body wants a margin
   * to start against instead of butting up under the buttons.
   *
   * A prop rather than a reading of `formatting`, even though the modal is
   * currently the only caller that sets either: they answer different questions
   * — "can this be formatted" and "how much space is there" — and a surface
   * that wanted one without the other would have to untangle them first.
   */
  spacing = "tight",
  className,
}: {
  content: string;
  onChange: (content: string) => void;
  appearance: NoteAppearance;
  onAppearanceChange?: (patch: NoteAppearancePatch) => void;
  readOnly?: boolean;
  formatting?: boolean;
  spacing?: "tight" | "roomy";
  className?: string;
}) {
  const isRoomy = spacing === "roomy";
  const bodyRef = useRef<NoteRichTextHandle>(null);

  const [formats, setFormats] = useState<NoteFormatState>(NO_FORMATS);
  const [linkDialog, setLinkDialog] = useState<{
    text: string;
    href: string | null;
  } | null>(null);

  /*
    The name's own paint — and pointedly not its size.

    `--note-font-size` is the size of the *writing*, and the name is not
    writing: it is the note's label, the thing the card shows and the wall is
    scanned by. Sizing the body up to 24px used to take the heading with it,
    which made a long name unreadable in a 14rem card and turned the modal into
    two headlines. It keeps the family and the ink, so it is still visibly the
    same note, and takes its size from the surface it is on.
  */
  const fieldStyle = {
    // `backgroundColor` and not `background` — the shorthand would reset
    // `background-image`, which is how the ruled lines are drawn. See
    // `NoteRichText`.
    backgroundColor: "var(--note-bg)",
    color: "var(--note-ink)",
    fontFamily: "var(--note-font-family)",
  };

  /**
   * The size the caret is sitting in, when that is not the note's own.
   *
   * Shown in the size control so it describes the text under the cursor rather
   * than the note's default — put the caret in a run that was made large and
   * the control says so, which is the only way the same control can mean two
   * things without lying about one of them.
   */
  const [caretSize, setCaretSize] = useState<number | null>(null);

  // Read off the browser rather than tracked in state: what is bold — and what
  // size the text is — depends on where the caret is, and only the document
  // knows that.
  const refreshFormats = useCallback(() => {
    setFormats(noteFormatState(bodyRef.current?.currentLink() !== null));
    setCaretSize(bodyRef.current?.currentFontSize() ?? null);
  }, []);

  /**
   * Which of the two things the appearance bar means.
   *
   * Everything on it is a property of the whole note — except size, which is
   * the one thing a person expects to apply to what they have selected. So a
   * size change with words selected sizes those words; with nothing selected it
   * moves the note's own default. Anything else goes straight through.
   *
   * Decided here rather than in the control, which is presentational and has no
   * idea a selection exists.
   */
  const handleAppearance = (patch: NoteAppearancePatch) => {
    const { fontSize, ...rest } = patch;

    if (fontSize !== undefined && bodyRef.current?.hasSelection()) {
      bodyRef.current.setFontSize(fontSize);
      refreshFormats();
    } else if (fontSize !== undefined) {
      onAppearanceChange?.({ fontSize });
    }

    if (Object.keys(rest).length > 0) onAppearanceChange?.(rest);
  };

  const openLinkDialog = () => {
    const field = bodyRef.current;
    if (!field) return;

    // Before the dialog takes the focus — see `captureSelection`.
    field.captureSelection();
    setLinkDialog({ text: field.selectedText(), href: field.currentLink() });
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <Input
        value={noteTitleLine(content)}
        onChange={(event) =>
          onChange(joinNote(event.target.value, noteBody(content)))
        }
        onKeyDown={(event) => {
          // Enter would submit nothing and do nothing here; carrying on into
          // the note is what the key means on a sheet of paper.
          if (event.key !== "Enter") return;
          event.preventDefault();
          bodyRef.current?.focus();
        }}
        placeholder={readOnly ? "" : "Name this note…"}
        aria-label="Note name"
        spellCheck={false}
        readOnly={readOnly}
        data-note-field="title"
        style={fieldStyle}
        className={cn(
          // `md:` named alongside the base size, always: `Input` ships
          // `md:text-xs/relaxed`, and an unprefixed size neither merges it away
          // nor outranks it — see the heading below.
          "shrink-0 truncate border-none px-3 text-lg font-semibold outline-none placeholder:font-normal placeholder:opacity-50 md:text-lg",
          /*
            24px, and fixed: the name is the note's heading here, and it is
            deliberately not derived from `--note-font-size` — that one sizes
            the *writing*, and a heading that grew with it turned the dialog
            into two headlines. `h-auto` because `Input` ships a fixed `h-7`
            that the padding would otherwise have nothing to push against.

            `md:text-2xl` as well as `text-2xl`, and it is not redundant:
            `Input` ships `md:text-xs/relaxed`, which is a different variant, so
            an unprefixed size neither merges it away nor outranks it — the
            heading was 24px on a phone and 12px on every desktop. Naming the
            same breakpoint puts the two in one group, where `cn` keeps the
            later of them and the media rule disappears entirely.
          */
          isRoomy && "h-auto px-5 pt-4 pb-3 text-2xl md:text-2xl",
          // `focus-visible:`, not `focus:` — the ring the note is turning off
          // is written under that variant, and browsers treat a focused text
          // field as always matching it. A ring drawn inside a note's own edge
          // reads as damage rather than as focus; the caret is the indicator.
          "focus-visible:border-transparent focus-visible:ring-0",
          // A read-only card is something to click, not something to select
          // into — without this a double-click highlights a word on its way to
          // opening the editor.
          readOnly && "cursor-pointer select-none",
        )}
      />

      {formatting && !readOnly && (
        /*
          One bar, three groups, left to right by what they act on: the note's
          own properties, then its colours, then the words in it.

          Wrapping, because a row of two selects, three colour buttons and six
          command buttons is wider than a narrow dialog — and wrapping is the
          one behaviour that keeps every control reachable rather than pushing
          the last of them off the edge.

          `NO_DRAG_ATTRIBUTE` on the bar itself now that it is the container:
          the card underneath is draggable, and a select opened with a press and
          a drag would otherwise start moving the note.
        */
        <div
          {...{ [NO_DRAG_ATTRIBUTE]: "" }}
          style={{ borderColor: "var(--note-edge)" }}
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1.5 border-y px-2 py-1",
            // Narrow screens keep a smaller inset: every millimetre taken here
            // is a millimetre the controls have to wrap out of.
            isRoomy && "px-3 py-2 sm:px-4",
          )}
        >
          {onAppearanceChange && (
            <>
              <NoteAppearanceInline
                value={appearance}
                fontSizeValue={caretSize}
                onChange={handleAppearance}
              />
              {/* A hairline between the two kinds of control, not a gap: the
                  point is that they are one row of things you reach for, with a
                  seam showing which are about the note and which about the
                  words. */}
              <span
                aria-hidden
                className="mx-0.5 h-4 w-px shrink-0 bg-[color:var(--note-edge)]"
              />

              {/* The three colour controls, between the note's other properties
                  and the commands that act on its words — because that is what
                  they are, one of each. */}
              <NoteColourControls
                onChange={handleAppearance}
                onHighlight={(hex) => {
                  bodyRef.current?.setHighlight(hex);
                  refreshFormats();
                }}
              />

              <span
                aria-hidden
                className="mx-0.5 h-4 w-px shrink-0 bg-[color:var(--note-edge)]"
              />
            </>
          )}

          <NoteFormatToolbar
            state={formats}
            onInline={(format: NoteInlineFormat) => {
              bodyRef.current?.format(format);
              refreshFormats();
            }}
            onList={(format: NoteListFormat) => {
              bodyRef.current?.list(format);
              refreshFormats();
            }}
            onLink={openLinkDialog}
          />
        </div>
      )}

      <NoteRichText
        ref={bodyRef}
        body={noteBody(content)}
        onChange={(bodyHtml) =>
          onChange(joinNote(noteTitleLine(content), bodyHtml))
        }
        readOnly={readOnly}
        placeholder={readOnly ? undefined : "Write something…"}
        onSelectionChange={formatting ? refreshFormats : undefined}
        // `flex-1` with `min-h-0` is what keeps the card one height: the field
        // takes what is left and scrolls the rest, instead of the content
        // deciding how tall the note is.
        className={cn(
          // Clear of the rule above it, and inset to the same margin as the
          // name — the two are the same column of text and should start on the
          // same line.
          isRoomy && "px-5 pt-4 pb-5",
          appearance.showGrid && "note-ruled",
        )}
      />

      {/*
        Rendered from here rather than from the toolbar, so it outlives the
        button's own state and so the field it writes back into is the one this
        component holds a handle on.
      */}
      <NoteLinkDialog
        open={linkDialog !== null}
        onOpenChange={(open) => !open && setLinkDialog(null)}
        text={linkDialog?.text ?? ""}
        initialHref={linkDialog?.href ?? null}
        onSubmit={(href) => {
          setLinkDialog(null);
          bodyRef.current?.link(href);
          refreshFormats();
        }}
        onRemove={() => {
          setLinkDialog(null);
          bodyRef.current?.unlink();
          refreshFormats();
        }}
      />
    </div>
  );
}
