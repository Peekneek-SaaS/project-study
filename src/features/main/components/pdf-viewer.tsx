"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Document, Page } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AnnotationLayer } from "@/features/annotations/components/annotation-layer";
import { useAnnotationSurface } from "@/features/annotations/hooks/use-annotation-surface";
import {
  ViewerControlButton,
  ViewerControlReadout,
  ViewerControls,
  ViewerControlSeparator,
  ViewerControlValue,
} from "@/features/main/components/viewer-controls";
// Imported for its side effect: pdf.js needs its worker before anything renders.
import "@/features/main/lib/pdfjs-worker";
import { cn } from "@/lib/utils";

/**
 * Pages kept mounted either side of the one being read.
 *
 * Every mounted page is a canvas the size of the viewport, so a lecture deck
 * would happily eat a few hundred megabytes if we rendered the lot.
 */
const RENDER_WINDOW = 2;

/** A4, used to size placeholders until the first real page reports its own. */
const DEFAULT_ASPECT = 1 / 1.4142;

/**
 * Zoom is unbounded in both directions, and steps by a factor rather than by a
 * fixed amount.
 *
 * Multiplying is what makes that safe as well as what makes it feel right: a
 * press moves the same *proportion* whether you are at 40% or at 900%, and
 * repeatedly halving approaches zero without ever reaching it, so there is no
 * cap to hit and no way to arrive at a zero-width page.
 *
 * `MIN_SCALE` is numeric safety rather than a limit anyone runs into — at 1% a
 * page is a few pixels tall, and it exists only so hundreds of presses cannot
 * underflow the float.
 */
const ZOOM_FACTOR = 1.25;
const MIN_SCALE = 0.01;

/**
 * The ceiling, the same at every screen size.
 *
 * 500% is past the point where the canvas stops being redrawn (see
 * `MAX_RENDER_PX`), so the last stretch is already CSS enlargement rather than
 * detail — going further would cost memory for a blurrier picture.
 */
const MAX_SCALE = 5;

/**
 * The largest a page is ever *rasterised* at, in pixels along its driving axis.
 *
 * Not a zoom limit — see below. pdf.js draws each page into a canvas, and a
 * canvas costs four bytes per pixel: a page rendered 6000px wide is around
 * 200MB on its own, and this keeps several mounted at once. Past this size the
 * canvas stops growing and CSS scales the result instead, so zooming carries on
 * without limit and only gets softer rather than taking the tab down with it.
 */
const MAX_RENDER_PX = 2400;

/**
 * Which way the pages run.
 *
 * `vertical` is a document scrolled the way documents are scrolled, and is what
 * a full-height panel or the preview modal wants. `horizontal` lays the pages
 * out side by side and is for a panel that is wide but short — the stacked
 * arrangement a small screen falls back to, where a vertically scrolling
 * document would show a sliver of a page at a time.
 */
export type PdfLayout = "vertical" | "horizontal";

export function PdfViewer({
  url,
  layout = "vertical",
  page,
  pageRequestId,
  documentId = null,
}: {
  url: string;
  layout?: PdfLayout;
  /**
   * The document these pages belong to, when notes may be written on them.
   *
   * Null for a viewer with nowhere to file a note — the preview of a file that
   * is not the reader's, say. Everything annotation-shaped is gated on this
   * rather than on a separate flag, because "which document" and "may I
   * annotate" have the same answer and two switches could disagree.
   */
  documentId?: string | null;
  /**
   * A page to jump to, 1-based — how a chat citation lands on the passage it
   * cites. Null or absent leaves the reader wherever they were.
   *
   * Not the *current* page: this viewer owns that, and taking it as a
   * controlled value would fight the scroll observer that tracks it. This is a
   * request to go somewhere, honoured once per distinct value.
   */
  page?: number | null;
  /**
   * Bumped by the caller to ask for the same page a second time.
   *
   * Without it the check below dedupes on the page number alone, so scrolling
   * away from a cited page and clicking the same citation again did nothing at
   * all — the number had not changed, so there was nothing for this to notice.
   */
  pageRequestId?: number;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [failed, setFailed] = useState(false);

  const [scale, setScale] = useState(1);

  /**
   * The size a page is measured against — captured, not tracked.
   *
   * This is the whole of "the document does not resize with the panel". The
   * container is still watched below, but only the *first* real measurement is
   * taken as the page's size; every one after that is remembered and otherwise
   * ignored. Dragging the panel therefore reveals or hides more of a page that
   * stays exactly the size it was, instead of the page rescaling under the
   * pointer on every frame of the drag.
   *
   * `null` until the container has been laid out once — zero is a real
   * measurement to reject, not a size to anchor to.
   */
  const [base, setBase] = useState<{ width: number; height: number } | null>(
    null,
  );

  /**
   * The room there is right now, which is a different question from the size a
   * page is drawn at. Only ever read when re-anchoring — see `base`.
   *
   * A panel drag re-renders this component through here, which is fine: `base`
   * does not move, so every one of those renders produces the same page size
   * and the DOM does not change.
   */
  const [available, setAvailable] = useState({ width: 0, height: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const isHorizontal = layout === "horizontal";

  // Notes written onto the pages. Scoped to this scroller, so two viewers open
  // on the same document — the panel and the floating window — cannot answer
  // for each other's selections.
  const annotations = useAnnotationSurface(documentId, scrollRef);

  // Pages are rendered to a fixed pixel size, so the container has to be
  // measured rather than handed a percentage.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // `contentRect` is the *content* box, so the gutter the page list is padded
    // with is already out of these numbers. Subtracting it here as well — as
    // this used to — took it off twice and left every page narrower than the
    // panel it was fitted to.
    const observer = new ResizeObserver(([entry]) => {
      setAvailable({
        width: Math.max(0, entry.contentRect.width),
        height: Math.max(0, entry.contentRect.height),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /**
   * Flipping between stacked and side-by-side pages forgets the anchor.
   *
   * The two layouts fit to different axes, so a base captured for one says
   * nothing useful about the other — a page fitted to a tall panel's width is
   * not a page fitted to a short panel's height. Dropped to `null` here and
   * re-taken below from the current measurement.
   *
   * Adjusted during render rather than in an effect: this is the "a prop
   * changed, derive from it" case React documents, and an effect would paint a
   * frame at the stale size before correcting it.
   */
  const [renderedLayout, setRenderedLayout] = useState(layout);
  if (renderedLayout !== layout) {
    setRenderedLayout(layout);
    setBase(null);
  }

  // Anchors on the first real measurement and then stands still. Every later
  // one is the panel being dragged, which is not a reason to resize a document.
  if (base === null && available.width > 0 && available.height > 0) {
    setBase(available);
  }

  /** Re-anchors to whatever room there is now, and drops the zoom with it. */
  const fitToPanel = () => {
    if (available.width > 0 && available.height > 0) setBase(available);
    setScale(1);
  };

  /**
   * The size a page takes up on the page, at the current zoom.
   *
   * Driven by whichever axis the layout fits pages to — the width when they are
   * stacked, the height when they run across — with the other following from
   * the page's own aspect ratio. Only the driving one is handed to react-pdf:
   * passing both would let a rounding difference squash the render against the
   * box holding it.
   */
  const anchor = base ? (isHorizontal ? base.height : base.width) : 0;
  const driving = anchor * scale;

  const boxHeight = isHorizontal ? driving : 0;
  const boxWidth = isHorizontal ? driving * aspect : driving;

  const hasRoom = driving > 0;

  /**
   * How that size is split between the canvas and a CSS transform.
   *
   * Up to `MAX_RENDER_PX` the page is simply drawn at its full size and
   * `cssScale` is 1. Past it the canvas stops growing and the transform makes
   * up the difference, which is what lets the zoom keep going: the page gets
   * blurrier beyond that point, but it never stops responding and never asks
   * the browser for a canvas it cannot allocate.
   */
  const renderSize = Math.min(driving, MAX_RENDER_PX);
  const cssScale = renderSize > 0 ? driving / renderSize : 1;

  /**
   * Fewer pages held in reserve once the canvases are at full size.
   *
   * `cssScale > 1` is exactly the condition "every mounted page is now as large
   * as a canvas gets", where the neighbours either side cost as much as the one
   * being read. Zoomed in that far you are looking at one page anyway, so the
   * reserve shrinks rather than the ceiling dropping for everyone.
   */
  const renderWindow = cssScale > 1 ? 1 : RENDER_WINDOW;

  // Which page is being read, for the counter and for prev/next to step from.
  // Depends on the measurement too: the page elements this observes are only
  // rendered once the container has been measured, whichever lands second.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || pageCount === 0 || !hasRoom) return;

    const visibility = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number(entry.target.getAttribute("data-page"));
          visibility.set(page, entry.intersectionRatio);
        }
        // Whichever page fills the most of the viewport is the one being read.
        let best = 1;
        let bestRatio = 0;
        for (const [page, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = page;
          }
        }
        setCurrentPage(best);
      },
      { root: container, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    for (const node of pageRefs.current) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [pageCount, hasRoom]);

  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), pageCount);
    pageRefs.current[clamped - 1]?.scrollIntoView({
      // Only the axis the pages run along is driven. Left to `start` on both,
      // a zoomed-in page would be yanked back to its own left edge every time
      // the reader stepped forward.
      block: isHorizontal ? "nearest" : "start",
      inline: isHorizontal ? "start" : "nearest",
      behavior: "smooth",
    });
  };

  /**
   * Honours a requested page, once the document knows how many it has.
   *
   * Two conditions, and both are load-bearing. `pageCount` gates it because
   * `goToPage` clamps against a count that is zero until the PDF has loaded —
   * arriving from a citation would otherwise scroll nowhere and stay there. And
   * the ref is what makes this a one-shot per value: without it, every re-render
   * while the reader scrolls away would drag them back to the cited page.
   */
  const honoured = useRef<string | null>(null);
  useEffect(() => {
    if (!page || pageCount === 0) return;

    // The id and the page together, so a repeat of the same page is a request
    // this has not seen while a re-render with both unchanged still is not.
    const request = `${pageRequestId ?? 0}:${page}`;
    if (honoured.current === request) return;

    honoured.current = request;
    goToPage(page);
    // `goToPage` is redeclared every render and is deliberately not a
    // dependency; the ref above is what controls when this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageCount, pageRequestId]);

  const zoomBy = (factor: number) =>
    setScale((current) =>
      Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * factor)),
    );

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-medium">This PDF could not be displayed.</p>
        <p className="text-muted-foreground">
          It may still open in your browser directly.
        </p>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            Open in a new tab
          </a>
        </Button>
      </div>
    );
  }

  return (
    // `@container` so the controls below can size themselves to this frame —
    // the panel, or the floating window, rather than the window.
    <div className="@container relative h-full min-h-0 overflow-hidden">
      <div
        ref={scrollRef}
        className={cn(
          // `absolute inset-0` rather than `h-full`: it makes the scroller
          // exactly the size of this box and structurally unable to grow with
          // its content. The zoom pill is positioned against the same box, so
          // that is what keeps it pinned to the bottom of the *view* instead of
          // being carried off the end of a zoomed-in page.
          "absolute inset-0",
          // Both axes scroll whatever the layout: zooming past the fit is
          // exactly when the other axis needs to move too, which is the whole
          // point of being able to zoom in a panel this size.
          "overflow-auto overscroll-contain",
          // The gutter is reserved even when nothing is scrolling, so a
          // scrollbar appearing does not narrow the box this measures itself
          // from. Without it, resizing the panel walks into a loop: narrower
          // box, taller pages, scrollbar appears, box narrows again.
          "scrollbar-gutter-stable",
        )}
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
          onLoadError={() => setFailed(true)}
          onSourceError={() => setFailed(true)}
          loading={
            <div className="flex h-full items-center justify-center py-16">
              <Spinner />
            </div>
          }
          error={null}
          className={cn(
            // The gap between pages stays; the gutter around them is only there
            // to keep their shadows off the panel edge.
            "flex items-center gap-4 p-2",
            /*
              `max-content`, emphatically not `fit-content`. Both look like
              "be as wide as the pages", but `fit-content` is capped at the
              space available — it will never exceed the scroller, so a zoomed
              page ends up centred inside a container that stayed panel-width
              and spills out of both sides with no scrollable width to reach
              it. `max-content` grows to the pages, which is what gives the
              scroller something to scroll. The `min-*-full` floor keeps short
              content centred in the panel rather than hugging one corner.
            */
            isHorizontal
              ? "h-max min-h-full w-max flex-row"
              : "w-max min-w-full flex-col",
          )}
        >
          {hasRoom &&
            Array.from({ length: pageCount }, (_, index) => {
              const pageNumber = index + 1;
              const isNear = Math.abs(pageNumber - currentPage) <= renderWindow;

              return (
                /*
                  Two boxes where there used to be one, and the split is what
                  lets a note be read.

                  This outer one is the page as laid out — it carries the size,
                  the `data-page` the selection and the scroll observer both
                  look for, and nothing that clips. The inner one keeps the
                  `overflow-hidden` that the rounded corners and the canvas
                  need. With the two folded together, a popover opening off a
                  marker was cut off at the page edge, and the anchor maths had
                  to measure against a box that was also doing the clipping.
                */
                <div
                  key={pageNumber}
                  data-page={pageNumber}
                  ref={(node) => {
                    pageRefs.current[index] = node;
                  }}
                  // Placeholders hold the scrollbar honest, so scrolling past
                  // unrendered pages does not shuffle everything underneath.
                  style={
                    isHorizontal
                      ? { width: boxWidth, height: boxHeight }
                      : { width: boxWidth, minHeight: boxWidth / aspect }
                  }
                  className="relative shrink-0"
                >
                  <div
                    className={cn(
                      "size-full overflow-hidden rounded shadow-lg",
                      !isNear && "animate-pulse bg-muted",
                    )}
                  >
                    {isNear && (
                      /*
                      The canvas is drawn at `renderSize` and stretched the rest
                      of the way. `origin-top-left` so the growth pushes down
                      and to the right into the box measured above, rather than
                      spreading from the middle and out of both sides of it.
                    */
                      <div
                        style={{
                          transform: `scale(${cssScale})`,
                          transformOrigin: "top left",
                          // Sized so the transform has the render's own box to
                          // scale from, not the zoomed one it is producing.
                          ...(isHorizontal
                            ? { height: renderSize }
                            : { width: renderSize }),
                        }}
                      >
                        <Page
                          pageNumber={pageNumber}
                          // Only ever one of the two — see `boxWidth` above.
                          {...(isHorizontal
                            ? { height: renderSize }
                            : { width: renderSize })}
                          onLoadSuccess={(page) => {
                            if (pageNumber === 1)
                              setAspect(page.width / page.height);
                          }}
                          loading={null}
                        />
                      </div>
                    )}
                  </div>

                  {/*
                  Only for pages that are actually drawn. An unrendered page has
                  no text under the dots and is a grey placeholder the reader is
                  scrolling past, so markers on it would be pins in a blank
                  card — and the composer cannot appear on one at all, since
                  there is nothing there to have selected.
                */}
                  {annotations.enabled && isNear ? (
                    <AnnotationLayer {...annotations.layerProps(pageNumber)} />
                  ) : null}
                </div>
              );
            })}
        </Document>
      </div>

      {/*
        Always on screen, whatever state the document is in. It used to wait for
        a page count, which meant the one moment you most want to pull a page
        back — while it is still working out how big it is — was the moment the
        controls were missing.
      */}
      <ViewerControls>
        {pageCount > 1 && (
          <>
            <ViewerControlButton
              label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft />
            </ViewerControlButton>
            <ViewerControlReadout>
              {currentPage} / {pageCount}
            </ViewerControlReadout>
            <ViewerControlButton
              label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronRight />
            </ViewerControlButton>

            <ViewerControlSeparator />
          </>
        )}

        <ViewerControlButton
          label="Zoom out"
          disabled={scale <= MIN_SCALE}
          onClick={() => zoomBy(1 / ZOOM_FACTOR)}
        >
          <ZoomOut />
        </ViewerControlButton>
        {/*
          Doubles as the reset. A zoom control that can only step is a nuisance
          to get back out of once you are ten presses in, and "100%" is the
          obvious thing to press to mean "never mind".
        */}
        <ViewerControlValue label="Reset zoom" onClick={() => setScale(1)}>
          {Math.round(scale * 100)}%
        </ViewerControlValue>
        <ViewerControlButton
          label="Zoom in"
          disabled={scale >= MAX_SCALE}
          onClick={() => zoomBy(ZOOM_FACTOR)}
        >
          <ZoomIn />
        </ViewerControlButton>
        {/*
          Earns its place now that the page no longer follows the panel. The
          percentage beside it resets the *zoom*, which after a resize is no
          longer the same thing as filling the panel — this is the one that
          re-measures.
        */}
        <ViewerControlButton label="Fit to panel" onClick={fitToPanel}>
          <Maximize />
        </ViewerControlButton>
      </ViewerControls>
    </div>
  );
}
