"use client";

import { motion } from "motion/react";
import { Highlighter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnnotationNoteCard } from "@/features/annotations/components/annotation-note-card";
import { useDocumentAnnotations } from "@/features/annotations/hooks/use-annotations";
import type { Annotation } from "@/features/annotations/types";
import { listContainer, mountAnimation } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The notes written into the document, grouped by the page they mark.
 *
 * By page rather than by the day they were written, which is the whole reason
 * this list is worth having. A mark's date says when you were working; its page
 * says where it is, and where it is is the only reason anyone opens this list —
 * they are looking for the thing they wrote on the diagram in chapter four.
 * Running in page order also means the list reads in the same direction as the
 * document, so scrolling this panel and scrolling the page agree with each
 * other.
 *
 * Kept out of the sticky notes' own tab for reasons that go past tidiness:
 * these rows come from a different table and write back through a different
 * router, so they cannot join the tick-and-bulk-delete the notes share — ids
 * fed to `stickyNote.bulkRemove` would simply not be found.
 */
export function AnnotationNotesSection({
  documentId,
  onOpenPage,
  className,
}: {
  documentId: string;
  onOpenPage?: (pageNumber: number) => void;
  className?: string;
}) {
  const { annotations } = useDocumentAnnotations(documentId);

  const pages = groupByPage(annotations);

  if (pages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Highlighter className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Nothing marked yet</p>
          <p className="text-xs text-muted-foreground">
            Select any text in the document and choose Note. It leaves a dot you
            can come back to.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {pages.map((group) => (
        <section key={group.pageNumber} className="flex flex-col gap-3">
          <div
            className={cn(
              // Pinned like the notes tab's day headings, and to the same
              // height, so a reader moving between the two tabs sees the same
              // furniture in the same place.
              "sticky top-0 z-10 -mx-3 h-10 bg-background px-3",
              "flex items-center justify-between gap-2",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Page {group.pageNumber}
              </h2>
              <span className="shrink-0 bg-sidebar-primary px-1 py-0.5 text-xs tabular-nums text-white">
                {group.annotations.length}
              </span>
            </div>

            {onOpenPage ? (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => onOpenPage(group.pageNumber)}
              >
                Go to page
              </Button>
            ) : null}
          </div>

          <motion.div
            {...mountAnimation}
            variants={listContainer}
            // The same thresholds as the notes grid, so a card does not change
            // shape between the two tabs of one panel.
            className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3"
          >
            {group.annotations.map((annotation) => (
              <AnnotationNoteCard
                key={annotation.id}
                annotation={annotation}
                documentId={documentId}
                onOpenPage={onOpenPage}
              />
            ))}
          </motion.div>
        </section>
      ))}
    </div>
  );
}

/** The annotations, in page order, with the marks on each page kept together. */
function groupByPage(annotations: Annotation[]) {
  const byPage = new Map<number, Annotation[]>();

  for (const annotation of annotations) {
    const existing = byPage.get(annotation.pageNumber);
    if (existing) existing.push(annotation);
    else byPage.set(annotation.pageNumber, [annotation]);
  }

  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, rows]) => ({
      pageNumber,
      // Within one page, newest first — the same order the query hands back and
      // the same order the hover card lists them in, so a note is in the same
      // place wherever it is read. Sorted here rather than trusted, because the
      // optimistic insert puts a new row at the head of the whole list and not
      // of its page.
      annotations: [...rows].sort((a, b) =>
        a.createdAt > b.createdAt ? -1 : 1,
      ),
    }));
}
