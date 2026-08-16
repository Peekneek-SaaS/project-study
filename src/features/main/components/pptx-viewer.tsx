"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { init } from "pptx-preview";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * A .pptx deck, one slide at a time — read as slides, not converted to anything.
 *
 * `pptx-preview` unzips the deck and rebuilds each slide as positioned DOM, so
 * what is on screen is the real thing: text stays selectable, and it stays
 * crisp at any zoom because it is laid out rather than rasterised.
 *
 * Two things it also ships are deliberately not used. `preview()` renders every
 * slide *and* injects its own grey circular buttons and a "1/12" counter, all
 * inline-styled and unstyleable; `load()` is the same parse with none of that
 * attached, which is why it is the one called below. The controls at the bottom
 * of this file are the app's own, and match the PDF viewer's.
 */

/**
 * The width every slide is built at, before any scaling.
 *
 * The library bakes its scale in when the renderer is constructed — it divides
 * this by the deck's own width once and never revisits it — so a layout that
 * followed the panel would have to re-parse the file on every drag. Rendering
 * at one fixed size and fitting with a CSS transform costs nothing on resize,
 * and because slides are DOM rather than canvas, scaling them stays sharp.
 *
 * Large enough that scaling is usually *down*, which is the direction that
 * flatters text rendering.
 */
const RENDER_WIDTH = 1600;

/** Breathing room around the slide, in px, so it never touches the panel edge. */
const STAGE_PADDING = 24;

const ZOOM_FACTOR = 1.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

/** What `pptx-preview` hands back from `init`, narrowed to what is used here. */
type Previewer = ReturnType<typeof init>;

export function PptxViewer({ url }: { url: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<Previewer | null>(null);

  const [slideCount, setSlideCount] = useState(0);
  const [slide, setSlide] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  /** The deck's own shape, which decides how tall the fitted slide is. */
  const [aspect, setAspect] = useState(9 / 16);
  const [zoom, setZoom] = useState(1);

  /**
   * The size the slide is fitted to — captured, not tracked, exactly as the PDF
   * viewer captures its own.
   *
   * The panel is still measured below, but only the *first* real measurement
   * becomes the slide's size; every one after that is remembered and otherwise
   * ignored. Dragging the panel therefore reveals or hides more of a slide that
   * stays exactly the size it was, rather than rescaling under the pointer on
   * every frame of the drag.
   *
   * `null` until the stage has been laid out once — zero is a measurement to
   * reject, not a size to anchor to.
   */
  const [base, setBase] = useState<{ width: number; height: number } | null>(
    null,
  );

  /** The room there is right now. Only ever read when re-anchoring — see `base`. */
  const [available, setAvailable] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(([entry]) => {
      setAvailable({
        width: Math.max(0, entry.contentRect.width - STAGE_PADDING * 2),
        height: Math.max(0, entry.contentRect.height - STAGE_PADDING * 2),
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Anchors on the first real measurement and then stands still. Every later
  // one is the panel being dragged, which is not a reason to resize a slide.
  if (base === null && available.width > 0 && available.height > 0) {
    setBase(available);
  }

  /** Re-anchors to whatever room there is now, and drops the zoom with it. */
  const fitToPanel = () => {
    if (available.width > 0 && available.height > 0) setBase(available);
    setZoom(1);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Guards the async work below against a URL change or an unmount landing
    // mid-parse, which in StrictMode is the ordinary case rather than the edge.
    let live = true;

    setLoading(true);
    setFailed(false);
    setSlideCount(0);
    setSlide(0);

    const previewer = init(mount, {
      width: RENDER_WIDTH,
      // Not `"slide"`, despite this being a one-slide-at-a-time viewer: that
      // mode absolutely-positions each slide and centres it against a viewport
      // height the library owns. `"list"` lays a slide out in normal flow, and
      // showing one at a time is `renderSingleSlide`'s job either way.
      mode: "list",
    });
    previewerRef.current = previewer;

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const deck = await previewer.load(await response.arrayBuffer());
        if (!live) return;

        setAspect(deck.height / deck.width);
        setSlideCount(previewer.slideCount ?? 0);
        previewer.renderSingleSlide(0);
        setLoading(false);
      } catch {
        if (live) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      live = false;
      previewer.destroy();
      previewerRef.current = null;
      // `destroy` only detaches the library's internal listeners; the slide DOM
      // it appended is still in the mount, and a re-run would render the next
      // deck underneath the last one's slides.
      mount.replaceChildren();
    };
  }, [url]);

  const show = useCallback((index: number) => {
    const previewer = previewerRef.current;
    if (!previewer) return;

    const count = previewer.slideCount ?? 0;
    const clamped = Math.min(Math.max(index, 0), Math.max(0, count - 1));
    previewer.renderSingleSlide(clamped);
    setSlide(clamped);
  }, []);

  /**
   * The scale that lands the slide inside the panel, whichever way it ran out
   * of room first — a wide short panel is limited by height, a narrow tall one
   * by width. `zoom` multiplies it, so 100% always means "as it was fitted".
   *
   * Measured against `base` rather than what is on screen now, which is what
   * holds the slide still while the panel moves around it.
   */
  const renderedHeight = RENDER_WIDTH * aspect;
  const fit = base
    ? Math.min(base.width / RENDER_WIDTH, base.height / renderedHeight)
    : 0;
  const scale = fit * zoom;

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-medium">This presentation could not be displayed.</p>
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
    <div className="relative h-full min-h-0 overflow-hidden">
      <div
        ref={stageRef}
        className="absolute inset-0 grid place-items-center overflow-auto overscroll-contain p-6"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {/*
          Two boxes, because a transform does not change the space an element
          takes up. The outer one is the slide's size *after* scaling, so the
          scroller has something honest to measure and centre; the inner one is
          full size and shrunk onto it from its top-left corner.
        */}
        <div
          style={
            scale > 0
              ? { width: RENDER_WIDTH * scale, height: renderedHeight * scale }
              : undefined
          }
          className={cn(
            "shrink-0 overflow-hidden shadow-lg",
            loading && "invisible",
          )}
        >
          <div
            ref={mountRef}
            className="pptx-stage origin-top-left"
            style={{
              width: RENDER_WIDTH,
              height: renderedHeight,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-2">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-popover/95 p-1 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
          {slideCount > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                disabled={slide <= 0}
                onClick={() => show(slide - 1)}
                aria-label="Previous slide"
              >
                <ChevronLeft />
              </Button>
              <span className="px-1 tabular-nums" aria-live="polite">
                {slide + 1} / {slideCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                disabled={slide >= slideCount - 1}
                onClick={() => show(slide + 1)}
                aria-label="Next slide"
              >
                <ChevronRight />
              </Button>

              <span
                aria-hidden
                className="mx-1 h-4 w-px shrink-0 bg-foreground/15"
              />
            </>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            disabled={zoom <= MIN_ZOOM}
            onClick={() =>
              setZoom((current) => Math.max(MIN_ZOOM, current / ZOOM_FACTOR))
            }
            aria-label="Zoom out"
          >
            <ZoomOut />
          </Button>
          {/* Doubles as the reset, as in the PDF viewer — 100% is the obvious
              thing to press to mean "never mind". */}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full tabular-nums"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom to fit"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            disabled={zoom >= MAX_ZOOM}
            onClick={() =>
              setZoom((current) => Math.min(MAX_ZOOM, current * ZOOM_FACTOR))
            }
            aria-label="Zoom in"
          >
            <ZoomIn />
          </Button>
          {/* The percentage beside it resets the *zoom*, which after a resize
              is no longer the same thing as filling the panel — this is the one
              that re-measures. As in the PDF viewer. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={fitToPanel}
            aria-label="Fit the slide to the panel"
            title="Fit to panel"
          >
            <Maximize />
          </Button>
        </div>
      </div>
    </div>
  );
}
