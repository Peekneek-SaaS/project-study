"use client";

import { useEffect, useRef, useState } from "react";
import { init } from "pptx-preview";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The first slide of a deck, drawn small.
 *
 * Built the same way `PptxViewer` builds a slide, and for the same reason:
 * `pptx-preview` fixes its scale when the renderer is constructed, so the slide
 * is laid out once at a nominal width and fitted to the card with a transform.
 *
 * Centred rather than cropped from the top, which is where this parts company
 * with `PdfThumbnail`. A page is taller than the card and the top of it is the
 * informative part; a slide is a complete composition and wider than it is
 * tall, so it fits with room to spare — and cropping one would be throwing away
 * the half that says what the deck is.
 */

/** As in the viewer: laid out once at this width, then scaled onto the card. */
const RENDER_WIDTH = 1280;

export function PptxThumbnail({ url }: { url: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  /**
   * The card width the slide is fitted to — captured once, then held.
   *
   * Same rule as the viewers: the first real measurement is the size, and the
   * card is not measured again. A window drag reflows the grid continuously,
   * and a thumbnail that followed it would rescale on every frame of that.
   */
  const [width, setWidth] = useState(0);
  const [aspect, setAspect] = useState(9 / 16);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    // Disconnects itself the moment it has an answer, rather than filtering
    // later ones — there is no fit button on a card, so nothing ever asks for
    // a second measurement.
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
    if (!mount) return;

    let live = true;
    setReady(false);
    setFailed(false);

    const previewer = init(mount, { width: RENDER_WIDTH, mode: "list" });

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const deck = await previewer.load(await response.arrayBuffer());
        if (!live) return;

        setAspect(deck.height / deck.width);
        // Only the first. The deck is parsed whole either way — that is one
        // unzip — but rendering is per slide, so a card builds one slide's
        // worth of DOM rather than the whole presentation's.
        previewer.renderSingleSlide(0);
        setReady(true);
      } catch {
        if (live) setFailed(true);
      }
    })();

    return () => {
      live = false;
      previewer.destroy();
      mount.replaceChildren();
    };
  }, [url]);

  const scale = width > 0 ? width / RENDER_WIDTH : 0;

  return (
    <div ref={boxRef} className="grid h-full w-full place-items-center">
      {failed ? (
        <div className="text-xs text-muted-foreground">No preview</div>
      ) : (
        <>
          {!ready && (
            <Skeleton className="col-start-1 row-start-1 h-full w-full rounded-none" />
          )}
          {/* Sized to the scaled slide so the grid can centre it; the mount
              inside is full size and shrunk onto it. */}
          <div
            className="col-start-1 row-start-1 overflow-hidden"
            style={
              scale > 0
                ? {
                    width: RENDER_WIDTH * scale,
                    height: RENDER_WIDTH * aspect * scale,
                  }
                : undefined
            }
          >
            <div
              ref={mountRef}
              className="pptx-stage origin-top-left"
              style={{
                width: RENDER_WIDTH,
                height: RENDER_WIDTH * aspect,
                transform: `scale(${scale})`,
                // Hidden rather than unmounted: the mount has to exist before
                // the effect above can render into it.
                visibility: ready ? "visible" : "hidden",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
