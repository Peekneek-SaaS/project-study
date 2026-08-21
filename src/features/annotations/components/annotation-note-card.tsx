"use client";

import { useState } from "react";
import { motion } from "motion/react";

import { AnnotationNoteModal } from "@/features/annotations/components/annotation-note-modal";
import { useAnnotationMutations } from "@/features/annotations/hooks/use-annotations";
import { PAPER_DIVIDER, paperStyle } from "@/features/annotations/lib/paper";
import type { Annotation } from "@/features/annotations/types";
import { toNoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { noteBody, noteTitleLine } from "@/features/sticky-notes/lib/note-content";
import { noteBodyHtml } from "@/features/sticky-notes/lib/note-html";
import { listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One page note, as a card on the notes tab.
 *
 * Not a `NoteCard`. That component is built around a sticky note it can edit in
 * place, tick for a bulk delete, and recolour from its own toolbar — and every
 * one of those runs through the sticky-note router, which knows nothing about
 * this row. Reusing it would mean a card whose toolbar silently failed and a
 * tick box that fed ids into a bulk delete that could not find them.
 *
 * So this is the read view, and the modal behind it is where an annotation is
 * actually worked on — the same modal the dot on the page opens, so a note
 * edited from the tab and one edited from the margin are the same note in the
 * same editor.
 *
 * The page number is the part that earns this card its place. A note in the
 * margin is found by scrolling to it; the same note in a list is only useful if
 * it says where it came from.
 */
export function AnnotationNoteCard({
  annotation,
  documentId,
  onOpenPage,
}: {
  annotation: Annotation;
  documentId: string;
  /** Takes the reader to the page this was written on, when the panel can. */
  onOpenPage?: (pageNumber: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { setContent, setAppearance, deleteAnnotation } = useAnnotationMutations(
    annotation.id,
    documentId,
  );

  const appearance = toNoteAppearance(annotation);
  const body = noteBody(annotation.content);
  const title =
    noteTitleLine(annotation.content).trim() || annotation.quote || "Note";

  return (
    <>
      <motion.div variants={listItem} className="min-w-0">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={paperStyle(appearance)}
          className={cn(
            "flex h-44 w-full flex-col overflow-hidden border text-left shadow-sm",
            "transition-shadow hover:shadow-md",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          {/*
            The page, and the words. Both in the header rather than mixed into
            the body, because together they are what this note *is about* —
            and the body underneath is what the reader had to say about it.
          */}
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b px-2.5 py-1.5",
              PAPER_DIVIDER,
            )}
          >
            <span
              className="size-2 shrink-0"
              style={{ backgroundColor: "var(--note-marker)" }}
            />
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
              Page {annotation.pageNumber}
            </span>
          </span>

          {annotation.quote ? (
            <span className="line-clamp-2 shrink-0 px-2.5 pt-2 text-[11px] leading-snug italic opacity-65">
              “{annotation.quote}”
            </span>
          ) : null}

          {body.trim() ? (
            <span
              className="note-body min-h-0 flex-1 overflow-hidden px-2.5 py-2 text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: noteBodyHtml(body) }}
            />
          ) : (
            <span className="flex-1 px-2.5 py-2 text-xs opacity-50">
              No note written yet.
            </span>
          )}

          {onOpenPage ? (
            <span
              role="link"
              tabIndex={0}
              onClick={(event) => {
                // The card itself opens the note; this corner opens the page.
                // Stopped rather than nested as a real button, which would be
                // a button inside a button and invalid markup.
                event.stopPropagation();
                onOpenPage(annotation.pageNumber);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                onOpenPage(annotation.pageNumber);
              }}
              className={cn(
                "shrink-0 border-t px-2.5 py-1.5 text-[10px] opacity-70",
                "hover:bg-black/5 hover:opacity-100",
                PAPER_DIVIDER,
              )}
            >
              Go to page {annotation.pageNumber} →
            </span>
          ) : null}
        </button>
      </motion.div>

      <AnnotationNoteModal
        open={expanded}
        onOpenChange={setExpanded}
        title={title}
        quote={annotation.quote}
        content={annotation.content}
        onChange={setContent}
        appearance={appearance}
        onAppearanceChange={(patch) => void setAppearance(patch)}
        onDelete={() => {
          setExpanded(false);
          void deleteAnnotation();
        }}
      />
    </>
  );
}
