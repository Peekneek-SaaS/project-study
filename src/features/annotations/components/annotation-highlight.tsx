"use client";

import { useState } from "react";
import { Maximize2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
 * Hover reads, click writes. The hover card is the industry gesture and costs
 * nothing, but it does not exist on a touch screen, so pressing the highlight
 * opens the full note — which is the path a phone takes and the faster path on
 * a desktop once you know what you want.
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

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <mark
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
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        side="bottom"
        style={{ ...paperStyle(appearance), width: POPOVER_WIDTH }}
        className={cn(
          "max-h-[22rem] overflow-y-auto p-0 ring-[color:var(--note-edge)]",
          "[&_[data-slot=button]]:hover:bg-black/5",
          "[&_[data-slot=button]]:hover:text-[color:var(--note-ink)]",
        )}
      >
        {related.map((note, index) => (
          <AnnotationNoteBody
            key={note.id}
            annotation={note}
            documentId={documentId}
            // A rule between notes, never above the first.
            divided={index > 0}
          />
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * One note inside the card, with the two things you can do to it from here.
 *
 * Split out because each note needs its own mutations and its own modal, and a
 * hook cannot be called in a loop inside the parent.
 */
function AnnotationNoteBody({
  annotation,
  documentId,
  divided,
}: {
  annotation: Annotation;
  documentId: string;
  divided: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { setContent, setAppearance, deleteAnnotation } = useAnnotationMutations(
    annotation.id,
    documentId,
  );

  const body = noteBody(annotation.content);
  const title =
    noteTitleLine(annotation.content).trim() || annotation.quote || "Note";

  return (
    <>
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
            onClick={() => setExpanded(true)}
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

      <AnnotationNoteModal
        open={expanded}
        onOpenChange={setExpanded}
        title={title}
        quote={annotation.quote}
        content={annotation.content}
        onChange={setContent}
        appearance={appearance(annotation)}
        onAppearanceChange={(patch) => void setAppearance(patch)}
        onDelete={() => {
          setExpanded(false);
          void deleteAnnotation();
        }}
      />
    </>
  );
}

/** Kept out of the render body so the modal and the card cannot disagree. */
function appearance(annotation: Annotation) {
  return toNoteAppearance(annotation);
}
