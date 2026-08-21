"use client";

import { useCallback, useMemo } from "react";

import {
  annotationsOnPage,
  useDocumentAnnotations,
} from "@/features/annotations/hooks/use-annotations";
import { useDocumentSelection } from "@/features/annotations/hooks/use-document-selection";
import {
  anchorRectsOf,
  anchorsMatch,
  unionOfAnchors,
} from "@/features/annotations/lib/anchor";
import type { NoteColor } from "@/features/sticky-notes/lib/note-appearance";
import { joinNote } from "@/features/sticky-notes/lib/note-content";

/**
 * Everything a viewer needs to let notes be written onto it.
 *
 * Pulled out of the PDF viewer once there were three of them. The three files
 * look nothing alike to a reader — a scanned page, a Word document, a slide —
 * but underneath they are laid out identically: a box per page at a fixed size,
 * scaled by a CSS transform. That is the entire contract, and it is why this
 * hook can be dropped into any of them.
 *
 * A viewer has two jobs to hold up its end. Mark each page box with
 * `data-page`, counting from one, and hand the scroller it lives in to
 * `rootRef` so a selection can be told apart from one in another copy of the
 * same file. Then render an `AnnotationLayer` inside each of those boxes with
 * the props `layerProps` hands back.
 */
export function useAnnotationSurface(
  documentId: string | null,
  rootRef: React.RefObject<HTMLElement | null>,
) {
  const { annotations, createAnnotation, isCreating } =
    useDocumentAnnotations(documentId);

  const { selection, clearSelection } = useDocumentSelection(
    rootRef,
    Boolean(documentId),
  );

  /**
   * The selection, unless those exact words already carry a note.
   *
   * Two notes on one sentence were allowed for a while and were more trouble
   * than they were worth: identical rectangles stack invisibly, so the second
   * highlight is unreachable on its own and every hover has to disambiguate
   * between notes the reader cannot tell apart on the page. The words are
   * already marked and the note is already one hover away — offering to write a
   * second one on top is offering to make the page harder to read.
   *
   * Only an *exact* match is refused. A note on one word inside an annotated
   * sentence is a different range and still allowed, because that one the
   * reader can see and point at.
   */
  const isDuplicate = useMemo(() => {
    if (!selection) return false;

    return annotations.some((annotation) => {
      if (annotation.pageNumber !== selection.pageNumber) return false;
      const existing = unionOfAnchors(anchorRectsOf(annotation));
      return existing !== null && anchorsMatch(existing, selection.anchor);
    });
  }, [annotations, selection]);

  const activeSelection = isDuplicate ? null : selection;

  const save = useCallback(
    async (content: string, color: NoteColor) => {
      if (!documentId || !activeSelection) return;
      const selection = activeSelection;

      await createAnnotation({
        documentId,
        pageNumber: selection.pageNumber,
        quote: selection.quote,
        // The editor writes a *body*; a note's first line is its name, and an
        // annotation is not given one — see `joinNote` and the marker's title.
        content: joinNote("", content),
        // The colour the composer was showing while the note was written, so
        // the dot it collapses into is the paper it was written on.
        color,
        // The bounding box in the row's own columns, the lines beside it.
        ...selection.anchor,
        rects: selection.rects,
      });

      // Lets go of the words as well as the prompt — `clearSelection` does both
      // now, because dismissing had to do both to work at all.
      clearSelection();
    },
    [activeSelection, clearSelection, createAnnotation, documentId],
  );

  /**
   * What the layer on one page needs.
   *
   * The selection is handed only to the page it is actually on, so the composer
   * appears once rather than on every mounted page at the same coordinates.
   */
  const layerProps = useCallback(
    (pageNumber: number) => ({
      documentId: documentId ?? "",
      annotations: annotationsOnPage(annotations, pageNumber),
      selection:
        activeSelection?.pageNumber === pageNumber ? activeSelection : null,
      onCancelSelection: clearSelection,
      onSave: save,
      isSaving: isCreating,
    }),
    [activeSelection, annotations, clearSelection, documentId, isCreating, save],
  );

  return { enabled: Boolean(documentId), annotations, layerProps };
}
