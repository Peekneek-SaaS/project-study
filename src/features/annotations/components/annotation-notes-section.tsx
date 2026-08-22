"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Highlighter } from "lucide-react";

import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
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
 *
 * ## Why this one pages in the browser
 *
 * Every other scrolling list in the app asks the server for the next page. This
 * one cannot, and the reason is the viewer rather than this panel: the same
 * query feeds the marker layer that paints the dots onto the document's pages,
 * and it is fetched whole precisely so that a page scrolled to already has its
 * markers — see `listForDocument` on the router, which sets out the whole
 * argument. Paging that query would mean a dot on page 40 did not exist until
 * somebody had scrolled *this list* far enough to load it, which is a marker
 * layer that depends on a panel the reader may never open.
 *
 * So the rows all arrive at once and it is the *rendering* that is paged. That
 * is the half that actually costs something at this scale — a hundred rich
 * cards is a hundred editors' worth of DOM — and it is the half the reader
 * feels. The trade is that revealing more is instant, so the sentinel below
 * never spins: there is nothing to wait for, and a spinner over a wait that is
 * not happening is a lie about where the time goes.
 */

/**
 * How many pages' worth of marks are revealed at a time.
 *
 * Counted in page groups rather than in cards so a group is never half-drawn —
 * a heading reading "Page 12" with three of its seven marks under it, and the
 * rest arriving on the next scroll, reads as marks going missing. Eight is
 * roughly the same amount of list as a server page of thirty rows, at the two
 * or three marks a page most documents actually collect.
 */
const GROUPS_PER_REVEAL = 8;

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

  /*
    How much of the list is drawn, and which document that answer is about.

    The two are one piece of state rather than a count plus an effect that
    resets it. An effect would reset a render *late* — the panel would draw the
    new document's whole list once with the old count still in place, which on a
    heavily marked document is the exact stall this reveal exists to avoid. Held
    together and corrected during the render that notices the change, as the
    selection bars elsewhere do with their counts.
  */
  const [reveal, setReveal] = useState({
    documentId,
    count: GROUPS_PER_REVEAL,
  });
  if (reveal.documentId !== documentId) {
    setReveal({ documentId, count: GROUPS_PER_REVEAL });
  }

  // Read back through the same check, so the render that notices a new document
  // already draws the short list rather than waiting for the re-render.
  const revealed =
    reveal.documentId === documentId ? reveal.count : GROUPS_PER_REVEAL;

  const visible = pages.slice(0, revealed);
  const hasMore = revealed < pages.length;

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
      {visible.map((group) => (
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

      {/*
        The same sentinel as every other list, so the gesture is identical —
        scroll to the bottom and more appears. `isFetchingNextPage` is
        permanently false here because there is no fetch: the rows are already
        in hand and this only widens the slice of them being drawn. See the note
        at the top of this file.
      */}
      <InfiniteScrollSentinel
        hasNextPage={hasMore}
        isFetchingNextPage={false}
        fetchNextPage={() =>
          setReveal((current) => ({
            documentId,
            count: current.count + GROUPS_PER_REVEAL,
          }))
        }
      />
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
