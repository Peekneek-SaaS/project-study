"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The first page of a Word document, drawn small.
 *
 * Cropped from the top like `PdfThumbnail`, because this is the same shape of
 * thing: a page taller than the card, whose top is the part that says what the
 * document is.
 *
 * Everything but the first page is hidden in CSS rather than skipped here —
 * `docx-preview` renders a document, not a page, and has no option to stop
 * after one. The cost that actually matters is the parse, which happens either
 * way, so the extra work is DOM for pages nobody sees. Kept in check by the
 * options below, which drop the parts of a page a thumbnail cannot show anyway,
 * and by the card only mounting this once it is near the viewport.
 */
export function DocxThumbnail({ url }: { url: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  /** The page's own width in px, measured off the render — Letter and A4 differ. */
  const [pageWidth, setPageWidth] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    // Captured once and then held, as in the slide thumbnail and the viewers:
    // a window drag reflows the grid continuously, and a page that followed it
    // would rescale on every frame. The observer stops as soon as it has an
    // answer, since nothing on a card ever asks for a second one.
    const observer = new ResizeObserver(([entry]) => {
      const measured = entry.contentRect.width;
      if (measured <= 0) return;
      setWidth(measured);
      observer.disconnect();
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const styles = styleRef.current;
    if (!mount || !styles) return;

    let live = true;
    setFailed(false);
    setPageWidth(0);

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const file = await response.blob();
        if (!live) return;

        await renderAsync(file, mount, styles, {
          className: "docx-render",
          inWrapper: true,
          // Kept on: page breaks are what make this a *page* rather than the
          // whole document squashed into one tall block.
          breakPages: true,
          // All off. None of them are legible at thumbnail size, and each is
          // work per page across a document only one page of which is shown.
          renderHeaders: false,
          renderFooters: false,
          renderFootnotes: false,
          renderEndnotes: false,
          renderComments: false,
          renderChanges: false,
        });
        if (!live) return;

        // Measured rather than assumed: the transform below has to divide by
        // the real page width, and a document may be Letter, A4 or landscape.
        const page = mount.querySelector<HTMLElement>("section");
        setPageWidth(page?.offsetWidth ?? 0);
      } catch {
        if (live) setFailed(true);
      }
    })();

    return () => {
      live = false;
      mount.replaceChildren();
      styles.replaceChildren();
    };
  }, [url]);

  const scale = pageWidth > 0 && width > 0 ? width / pageWidth : 0;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden">
      <div ref={styleRef} hidden />

      {failed ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No preview
        </div>
      ) : (
        <>
          {scale === 0 && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          )}
          <div
            ref={mountRef}
            className="docx-thumb origin-top-left"
            style={{
              transform: `scale(${scale})`,
              // Full-size until measured, so the page lays out at its natural
              // width and `offsetWidth` reads the real thing.
              width: scale > 0 ? `${100 / scale}%` : undefined,
              visibility: scale > 0 ? "visible" : "hidden",
            }}
          />
        </>
      )}
    </div>
  );
}
