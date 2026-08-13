"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

const PAGE_GAP = 16;

export function PdfViewer({ url }: { url: string }) {
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [pageWidth, setPageWidth] = useState(0);
  const [failed, setFailed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Pages are rendered to a fixed pixel width, so the container has to be
  // measured rather than handed a percentage.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      // Leave room for the gutter the scroll container is padded with.
      setPageWidth(Math.max(0, entry.contentRect.width - PAGE_GAP * 2));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Which page is being read, for the counter and for prev/next to step from.
  // Depends on `pageWidth` too: the page elements this observes are only
  // rendered once the container has been measured, whichever lands second.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || pageCount === 0 || pageWidth === 0) return;

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
  }, [pageCount, pageWidth]);

  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), pageCount);
    pageRefs.current[clamped - 1]?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  };

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
    <div className="relative h-full">
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
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
          className="flex flex-col items-center gap-4 p-4"
        >
          {pageWidth > 0 &&
            Array.from({ length: pageCount }, (_, index) => {
              const pageNumber = index + 1;
              const isNear =
                Math.abs(pageNumber - currentPage) <= RENDER_WINDOW;

              return (
                <div
                  key={pageNumber}
                  data-page={pageNumber}
                  ref={(node) => {
                    pageRefs.current[index] = node;
                  }}
                  // Placeholders hold the scrollbar honest, so scrolling past
                  // unrendered pages does not shuffle everything underneath.
                  style={{ width: pageWidth, minHeight: pageWidth / aspect }}
                  className={cn(
                    "overflow-hidden rounded shadow-lg",
                    !isNear && "animate-pulse bg-muted",
                  )}
                >
                  {isNear && (
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      onLoadSuccess={(page) => {
                        if (pageNumber === 1) setAspect(page.width / page.height);
                      }}
                      loading={null}
                    />
                  )}
                </div>
              );
            })}
        </Document>
      </div>

      {pageCount > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-popover/95 p-1 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 tabular-nums" aria-live="polite">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
