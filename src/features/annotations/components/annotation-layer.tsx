"use client";

import { AnnotationHighlight } from "@/features/annotations/components/annotation-highlight";
import {
  anchorRectsOf,
  anchorsOverlap,
  type AnchorRect,
} from "@/features/annotations/lib/anchor";
import { AnnotationComposer } from "@/features/annotations/components/annotation-composer";
import type { DocumentSelection } from "@/features/annotations/hooks/use-document-selection";
import type { Annotation } from "@/features/annotations/types";
import type { NoteColor } from "@/features/sticky-notes/lib/note-appearance";

/**
 * Everything annotation-shaped that belongs to one page.
 *
 * Laid over the page rather than inside it. The page's own contents are pdf.js's
 * — a canvas and a text layer that are both thrown away and rebuilt whenever the
 * zoom changes — so anything of ours living in there would vanish on the next
 * press of the zoom button. This sits in a sibling box the same size, and every
 * child positions itself as a percentage of it.
 *
 * `pointer-events-none` on the layer, with `pointer-events-auto` written onto
 * the highlights themselves — never as a blanket `[&>*]` rule here, which once
 * handed the pointer back to elements that had explicitly given it up and made
 * annotated text impossible to select a second time.
 *
 * The highlights *do* take the pointer, which is new: they are the control now
 * that the dots are gone. That costs something real — a drag starting inside an
 * existing highlight selects nothing — and it is the trade every tool that
 * marks text this way makes. Starting the drag a word earlier still works, and
 * so does selecting across a highlight from outside it.
 */
export function AnnotationLayer({
  documentId,
  annotations,
  selection,
  onCancelSelection,
  onSave,
  isSaving,
}: {
  documentId: string;
  /** Already narrowed to this page by the caller, which is why there is no
      page number here — everything below is about *these* annotations. */
  annotations: Annotation[];
  /** The pending selection, when it happens to be on this page. */
  selection: DocumentSelection | null;
  onCancelSelection: () => void;
  onSave: (content: string, color: NoteColor) => void;
  isSaving: boolean;
}) {
  const pieces = toPieces(annotations);

  return (
    <div className="pointer-events-none absolute inset-0">
      {pieces.map((piece) => (
        <AnnotationHighlight
          key={`${piece.annotation.id}-${piece.index}`}
          rect={piece.rect}
          annotation={piece.annotation}
          /*
            Everything this line of highlight is under, not just its own note.

            A note on one word inside a note on the whole sentence overlaps it,
            so hovering the word offers both — which is what "I want to see the
            subtext note too" asks for. Computed per *line* rather than per
            annotation, so the word's note only joins the line it is actually
            on: hovering the sentence's other lines still offers the sentence
            alone.
          */
          related={overlapping(pieces, piece)}
          documentId={documentId}
        />
      ))}

      {selection ? (
        <AnnotationComposer
          // Keyed by where the selection is, so choosing a different sentence
          // without dismissing the prompt resets it to the first step instead
          // of leaving a half-written note pointing at the wrong words.
          key={`${selection.anchor.x}-${selection.anchor.y}`}
          selection={selection}
          onCancel={onCancelSelection}
          onSave={onSave}
          isSaving={isSaving}
        />
      ) : null}
    </div>
  );
}

/** One line of one note's highlight. */
interface Piece {
  annotation: Annotation;
  rect: AnchorRect;
  /** Which line of that note this is — only used to key the element. */
  index: number;
}

/**
 * Every note flattened into the lines it covers, largest first.
 *
 * The order is the whole of how overlapping notes stay reachable. Later
 * siblings paint over earlier ones and take the pointer where they overlap, so
 * sorting by area descending puts the *smallest* highlight on top — which means
 * a note on one word inside a note on a paragraph is the thing you hover when
 * you point at that word, rather than being buried under the larger one.
 */
function toPieces(annotations: Annotation[]): Piece[] {
  const pieces = annotations.flatMap((annotation) =>
    anchorRectsOf(annotation).map((rect, index) => ({
      annotation,
      rect,
      index,
    })),
  );

  return pieces.sort((a, b) => area(b.rect) - area(a.rect));
}

function area(rect: AnchorRect): number {
  return rect.width * rect.height;
}

/**
 * The notes whose highlights cross this line of this one, itself included.
 *
 * De-duplicated by note: a note wrapping over three lines can overlap this one
 * in more than one place, and it should still be listed once. Ordered the way
 * the annotations arrived — newest first — so the card reads in the same order
 * as every other list of these.
 */
function overlapping(pieces: Piece[], piece: Piece): Annotation[] {
  const seen = new Set<string>();
  const found: Annotation[] = [];

  for (const other of pieces) {
    if (seen.has(other.annotation.id)) continue;
    if (!anchorsOverlap(piece.rect, other.rect)) continue;

    seen.add(other.annotation.id);
    found.push(other.annotation);
  }

  return found;
}
