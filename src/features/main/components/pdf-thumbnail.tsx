"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";

import { Skeleton } from "@/components/ui/skeleton";
// Imported for its side effect: pdf.js needs its worker before anything renders.
import "@/features/main/lib/pdfjs-worker";

/**
 * The first page of a PDF, drawn small.
 *
 * The card crops it: the page is rendered at full card width and the top of it
 * is what shows, which is the part that says what the document is.
 */
export function PdfThumbnail({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);

  // `<Page>` renders to a pixel width, so the card has to be measured rather
  // than handed a percentage.
  //
  // Captured once and then held, matching the Word and PowerPoint thumbnails
  // and the viewers behind all three. It matters most here: this one does not
  // scale a rendered page, it re-rasterises it, so following a window drag
  // means pdf.js redrawing the canvas for every card on screen on every frame.
  // The observer stops as soon as it has an answer, since nothing on a card
  // ever asks for a second measurement.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const measured = entry.contentRect.width;
      if (measured <= 0) return;
      setWidth(measured);
      observer.disconnect();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      {failed ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No preview
        </div>
      ) : (
        width > 0 && (
          <Document
            file={url}
            loading={<Skeleton className="h-full w-full rounded-none" />}
            error={null}
            noData={null}
            onLoadError={() => setFailed(true)}
            onSourceError={() => setFailed(true)}
          >
            <Page
              pageNumber={1}
              width={width}
              // Neither layer is readable at this size, and both cost a DOM
              // tree per page.
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={<Skeleton className="h-full w-full rounded-none" />}
            />
          </Document>
        )
      )}
    </div>
  );
}
