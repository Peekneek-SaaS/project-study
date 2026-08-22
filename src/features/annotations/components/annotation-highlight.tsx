"use client";

import { useState } from "react";
import { Maximize2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AnnotationNoteModal } from "@/features/annotations/components/annotation-note-modal";
import { useAnnotationMutations } from "@/features/annotations/hooks/use-annotations";
import {
  anchorToHighlightStyle,
  type AnchorRect,
} from "@/features/annotations/lib/anchor";
import {
  PAPER_DIVIDER,
  markerStyle,
  paperStyle,
} from "@/features/annotations/lib/paper";
import {
  POPOVER_BODY_MAX_HEIGHT,
  POPOVER_WIDTH,
  type Annotation,
} from "@/features/annotations/types";
import { toNoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { noteBody, noteTitleLine } from "@/features/sticky-notes/lib/note-content";
import { noteBodyHtml } from "@/features/sticky-notes/lib/note-html";
import { useHasHover } from "@/hooks/use-hover";
import { cn } from "@/lib/utils";

/**
 * The annotated words themselves, marked and readable.
 *
 * This replaced a dot in the margin, and the change is the whole interaction
 * rather than a restyling. A dot is an index: it says *that* something was
 * noted here and makes you click to find out what. A highlight is the mark
 * itself — the page shows you what you marked while you are reading it, and the
 * note is one hover away. It is what every tool that does this settled on,
 * because it is what a highlighter and a margin note are on paper.
 *
 * One highlight can carry several notes. Annotating the same sentence twice is
 * something people do — and something explicitly asked for here — and two
 * separate highlights over identical words would be one invisible rectangle
 * stacked exactly on another, with only the topmost reachable. So the layer
 * groups them by the words they cover and hands the whole group here.
 *
 * The same card, opened by whichever gesture the device has. A hover card is
 * the industry gesture and costs nothing on a mouse, but hover does not exist
 * on a touch screen — which left a phone with the mark and no way to read what
 * was under it, since nothing here was ever listening for the tap. A device
 * that cannot hover now gets a popover holding the identical card: same notes,
 * same buttons, same route into the editor through *Open*.
 *
 * Branched on the device rather than on the width, because what decides it is
 * whether there is a pointer to hover with — see `useHasHover`.
 */
export function AnnotationHighlight({
  rect,
  annotation,
  related,
  documentId,
}: {
  /** The one line of the note this element paints. */
  rect: AnchorRect;
  /** The note this line belongs to — it decides the colour. */
  annotation: Annotation;
  /** Everything crossing this line, including the note itself. */
  related: Annotation[];
  documentId: string;
}) {
  const appearance = toNoteAppearance(annotation);
  const hasHover = useHasHover();

  /**
   * Which of these notes is open full size, by id.
   *
   * Held here rather than inside the card, and that is what makes *Open* work
   * on a touch screen. The modal used to be rendered by the row that opened it,
   * inside the card — so the moment the dialog took focus, the popover counted
   * that as focus leaving, closed, and unmounted the dialog it had just opened.
   * Out here the card is free to close behind it, which on a phone is exactly
   * what should happen: the note is now the whole screen.
   */
  const [expanded, setExpanded] = useState<string | null>(null);

  const mark = (
    <mark
      /*
        Focusable, and labelled. The ring below was written for a focus that
        could never arrive: neither trigger adds a `tabIndex` of its own, so the
        mark sat outside the tab order with nothing but a colour to say it was
        there. With it, the keyboard reaches the highlight and opens the same
        card the pointer and the finger do.
      */
      tabIndex={0}
      aria-label={
        related.length > 1 ? `Open ${related.length} notes` : "Open note"
      }
      style={{
        ...anchorToHighlightStyle(rect),
        ...markerStyle(appearance),
        backgroundColor: "var(--note-bg)",
      }}
      /*
        `mix-blend-multiply`, in both themes, and never `screen`.

        The wash sits *over* the page because the page is a canvas and there
        is no behind to reach — the letters are pixels in the same image as
        the paper. Multiply is what makes that work: black multiplied by any
        colour is still black, so the type comes through untouched and only
        the white around it takes the tint. Exactly what a highlighter does
        to a printed page.

        It also does the right thing where two highlights overlap. Two
        washes multiplied are darker than one, so a note inside a note shows
        as a deeper band without anything having to compute it.
      */
      className={cn(
        "pointer-events-auto absolute cursor-pointer mix-blend-multiply",
        "transition-[filter] hover:brightness-95",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    />
  );

  const notes = related.map((note, index) => (
    <AnnotationNoteBody
      key={note.id}
      annotation={note}
      documentId={documentId}
      // A rule between notes, never above the first.
      divided={index > 0}
      onExpand={() => setExpanded(note.id)}
    />
  ));

  /**
   * One description of the paper for both cards, so the tap and the hover
   * cannot drift into two different-looking notes.
   *
   * `max-w` as well as the fixed width: 280px is comfortable on a laptop and
   * most of a narrow phone, and a card that cannot shrink is a card with a
   * corner off the screen. `collisionPadding` keeps it clear of the edges
   * either way.
   */
  const card = {
    align: "start",
    side: "bottom",
    collisionPadding: 8,
    style: { ...paperStyle(appearance), width: POPOVER_WIDTH },
    className: cn(
      "max-h-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 overflow-y-auto p-0",
      "ring-[color:var(--note-edge)]",
      "[&_[data-slot=button]]:hover:bg-black/5",
      "[&_[data-slot=button]]:hover:text-[color:var(--note-ink)]",
    ),
  } as const;

  return (
    <>
      {hasHover ? (
        <HoverCard openDelay={120} closeDelay={120}>
          <HoverCardTrigger asChild>{mark}</HoverCardTrigger>
          <HoverCardContent {...card}>{notes}</HoverCardContent>
        </HoverCard>
      ) : (
        <Popover>
          <PopoverTrigger asChild>{mark}</PopoverTrigger>
          <PopoverContent
            {...card}
            /*
              The tap opens the card and nothing else. Focus would otherwise
              land inside it and, on a phone, bring the keyboard up with it —
              this card is something to read, and *Open* is the way to something
              to write.
            */
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            {notes}
          </PopoverContent>
        </Popover>
      )}

      {/*
        One modal per note, mounted alongside the card rather than inside it.
        Radix renders nothing for a closed dialog, so this is the same cost as
        the single one that used to live in the row — see `expanded`.
      */}
      {related.map((note) => (
        <AnnotationNoteEditor
          key={note.id}
          annotation={note}
          documentId={documentId}
          open={expanded === note.id}
          onOpenChange={(open) => setExpanded(open ? note.id : null)}
        />
      ))}
    </>
  );
}

/**
 * One note inside the card, with the two things you can do to it from here.
 *
 * Split out because each note needs its own mutations, and a hook cannot be
 * called in a loop inside the parent. Opening the note full size is *not* one
 * of them: the card is a thing that closes, so the modal is owned above.
 */
function AnnotationNoteBody({
  annotation,
  documentId,
  divided,
  onExpand,
}: {
  annotation: Annotation;
  documentId: string;
  divided: boolean;
  onExpand: () => void;
}) {
  const { deleteAnnotation } = useAnnotationMutations(annotation.id, documentId);

  const body = noteBody(annotation.content);

  return (
    <div className={cn(divided && cn("border-t", PAPER_DIVIDER))}>
      <div
        style={{ maxHeight: POPOVER_BODY_MAX_HEIGHT }}
        className="overflow-hidden px-3 py-2"
      >
        {body.trim() ? (
          <div
            className="note-body text-xs leading-relaxed"
            /*
              `noteBody`, then `noteBodyHtml`. A note's text is one string
              whose *first line is its name* — the helper takes the body
              alone, and handing it the whole thing would render the title
              line into the paragraph as though it were prose.
            */
            dangerouslySetInnerHTML={{ __html: noteBodyHtml(body) }}
          />
        ) : (
          <p className="text-xs opacity-60">This note is empty.</p>
        )}
      </div>

      <div
        className={cn("flex items-center gap-1 border-t px-2 py-1", PAPER_DIVIDER)}
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={onExpand}
          className="gap-1.5"
        >
          <Maximize2 />
          Open
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Delete note"
          onClick={() => void deleteAnnotation()}
          className="ml-auto opacity-60"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

/** The same note, full size, with everything that can be changed about it. */
function AnnotationNoteEditor({
  annotation,
  documentId,
  open,
  onOpenChange,
}: {
  annotation: Annotation;
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setContent, setAppearance, deleteAnnotation } = useAnnotationMutations(
    annotation.id,
    documentId,
  );

  const title =
    noteTitleLine(annotation.content).trim() || annotation.quote || "Note";

  return (
    <AnnotationNoteModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      quote={annotation.quote}
      content={annotation.content}
      onChange={setContent}
      appearance={appearance(annotation)}
      onAppearanceChange={(patch) => void setAppearance(patch)}
      onDelete={() => {
        onOpenChange(false);
        void deleteAnnotation();
      }}
    />
  );
}

/** Kept out of the render body so the modal and the card cannot disagree. */
function appearance(annotation: Annotation) {
  return toNoteAppearance(annotation);
}
