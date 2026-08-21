"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { renderAsync } from "docx-preview";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AnnotationLayer } from "@/features/annotations/components/annotation-layer";
import { useAnnotationSurface } from "@/features/annotations/hooks/use-annotation-surface";
import {
  ViewerControlButton,
  ViewerControls,
  ViewerControlValue,
} from "@/features/main/components/viewer-controls";
import { cn } from "@/lib/utils";

/**
 * A .docx, read as a document — not converted, and not flattened to HTML.
 *
 * `docx-preview` walks the OOXML and rebuilds the real page geometry: the
 * section's own paper size and margins, headers, footers, footnotes and the
 * page breaks Word recorded. That is what makes this read like the PDF viewer
 * next to it — a column of paper-sized pages — while still being the .docx.
 *
 * The text stays text, so it is selectable and searchable with the browser's
 * own find, which a rasterised page would not be.
 *
 * And because those pages are real boxes at a fixed size — the stage is *scaled*
 * by a transform rather than reflowed — notes can be anchored to them exactly
 * as they are on a PDF. The sections are built by `docx-preview` rather than by
 * React, so they are tagged and collected after the render and each one has its
 * annotation layer portalled into it; see `pages` below.
 */

const ZOOM_FACTOR = 1.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function DocxViewer({
  url,
  documentId = null,
  page,
  pageRequestId,
}: {
  url: string;
  /** The document these pages belong to, when notes may be written on them. */
  documentId?: string | null;
  /** A page to open at, 1-based, for a citation or a note. */
  page?: number | null;
  /** Lets the same page be asked for twice — see `PdfViewer`. */
  pageRequestId?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  /**
   * The page's own width in px, measured off the render.
   *
   * Not assumed, because a document carries its own paper: Letter and A4 differ
   * by about 5%, and a landscape section by a great deal more. This is what the
   * fit below divides by.
   */
  const [pageWidth, setPageWidth] = useState(0);

  /** The rendered height of the whole document, for the scroller to reserve. */
  const [contentHeight, setContentHeight] = useState(0);

  /**
   * The page elements `docx-preview` built, once it has built them.
   *
   * Held in state rather than read from a ref at render time because that is
   * what makes them portal targets: React has to re-render when they appear,
   * and a ref changing does not cause one. Reset to empty on every reload, so a
   * new document cannot portal its layers into the last one's detached nodes.
   */
  const [pages, setPages] = useState<HTMLElement[]>([]);

  const annotations = useAnnotationSurface(documentId, scrollRef);

  /**
   * The width the page is fitted to — captured, not tracked, as in the PDF
   * viewer. Only the first real measurement counts; later ones are remembered
   * for the fit button and otherwise ignored, so dragging the panel reveals or
   * hides more of a page that stays exactly the size it was.
   */
  const [base, setBase] = useState<number | null>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    // `contentRect` is the *content* box: the scroller's own padding is already
    // out of this. Subtracting a gutter here as well — as this used to — took it
    // off twice and fitted the page to a width narrower than the panel's.
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(Math.max(0, entry.contentRect.width));
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const styles = styleRef.current;
    if (!mount || !styles) return;

    // As in the pptx viewer: an unmount or a URL change can land mid-parse, and
    // under StrictMode that is the ordinary case rather than the edge.
    let live = true;

    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const file = await response.blob();
        if (!live) return;

        await renderAsync(file, mount, styles, {
          // The document's own stylesheet is scoped under this, so it cannot
          // reach the rest of the app — a .docx that styles `p` or `table`
          // stays inside its own pages.
          className: "docx-render",
          // The wrapper is what carries the paper: page size, margins and the
          // gaps between pages all hang off it. Without it the content runs as
          // one undifferentiated column and stops resembling a document.
          inWrapper: true,
          breakPages: true,
          // Kept, because they are part of what the page looks like — dropping
          // them would silently reflow anything anchored to a header or a note.
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          // Tracked changes and comments stay hidden: this is a reader, and the
          // document should look the way its author left it, not like a review.
          renderChanges: false,
          renderComments: false,
          // Images as data URLs rather than object URLs. Object URLs are tied
          // to the document that made them and are revoked with it; these
          // survive, which matters because the panel remounts this viewer
          // whenever the layout changes around it.
          useBase64URL: true,
        });

        if (!live) return;

        // Read before any transform is applied, so these are the document's
        // own dimensions rather than scaled ones.
        const sections = [...mount.querySelectorAll<HTMLElement>("section")];
        setPageWidth(sections[0]?.offsetWidth ?? 0);
        setContentHeight(mount.scrollHeight);

        /*
          Tagged so a selection can say which page it landed on, and made a
          containing block so the layer portalled inside can position against
          the page rather than against whatever ancestor happens to be
          positioned. Both are written onto DOM this component did not create,
          which is the price of a renderer that builds its own nodes.
        */
        sections.forEach((section, index) => {
          section.dataset.page = String(index + 1);
          section.style.position = "relative";
        });
        setPages(sections);

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
      // Emptied before the nodes go, or the portals below would spend a render
      // pointing at sections that have been detached from the document.
      setPages([]);
      // Both are cleared: a re-run appends a fresh copy of the document *and*
      // another copy of its stylesheet, and the second stylesheet would go on
      // styling pages that are no longer there.
      mount.replaceChildren();
      styles.replaceChildren();
    };
  }, [url]);

  // Anchors on the first measurement taken once the page's own width is known —
  // before that there is nothing to fit *to*, and a base captured early would
  // be a width the document never had.
  if (base === null && available > 0 && pageWidth > 0) {
    setBase(available);
  }

  /**
   * Honours a requested page, once the document has been laid out.
   *
   * The same one-shot-per-request rule the PDF viewer uses, and for the same
   * reason: without it every re-render while the reader scrolls away would drag
   * them back. `pages` gates it because there is nothing to scroll to until
   * `docx-preview` has finished.
   */
  const honoured = useRef<string | null>(null);
  useEffect(() => {
    if (!page || pages.length === 0) return;

    const request = `${pageRequestId ?? 0}:${page}`;
    if (honoured.current === request) return;
    honoured.current = request;

    pages[Math.min(page, pages.length) - 1]?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [page, pageRequestId, pages]);

  /** Re-anchors to whatever room there is now, and drops the zoom with it. */
  const fitToPanel = () => {
    if (available > 0) setBase(available);
    setZoom(1);
  };

  /**
   * Never enlarged past its natural size — a page blown up to fill a wide panel
   * is just a blurrier page, and Word's own reading views do not do it either.
   * Zoom is there for anyone who wants it bigger anyway.
   */
  const fit = base && pageWidth > 0 ? Math.min(1, base / pageWidth) : 0;
  const scale = fit * zoom;

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-medium">This document could not be displayed.</p>
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
      {/* Where docx-preview puts the document's own `<style>`. Kept out of the
          scroller so it is never part of what is laid out or measured. */}
      <div ref={styleRef} hidden />

      <div
        ref={scrollRef}
        // Only enough to keep the page's edge off the panel's — the document is
        // what the panel is for.
        className="absolute inset-0 overflow-auto overscroll-contain p-2"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {/*
          Two boxes, as in the slide viewer, because a transform does not change
          the space an element takes up. The outer one is the document's size
          *after* scaling — so the scroller has an honest length to scroll and
          no band of empty space past the last page — and the inner one is full
          size, shrunk onto it from its top-left corner.
        */}
        <div
          className="mx-auto"
          style={
            scale > 0
              ? { width: pageWidth * scale, height: contentHeight * scale }
              : undefined
          }
        >
          <div
            ref={mountRef}
            className={cn("docx-stage origin-top-left", loading && "invisible")}
            style={{
              width: pageWidth > 0 ? pageWidth : undefined,
              transform: scale > 0 ? `scale(${scale})` : undefined,
            }}
          />

          {/*
            One layer per page, portalled into the section it belongs to.

            Portalled rather than laid over the stage as a single sheet, so each
            layer's percentages resolve against its own page — which is what the
            anchors are fractions of. A single overlay would have to know where
            every page starts within the stage and recompute it on every zoom.

            The transform on the stage is inherited by these, so a marker scales
            with the page it is on without any of this arithmetic knowing that
            the zoom exists.
          */}
          {annotations.enabled &&
            pages.map((section, index) =>
              createPortal(
                <AnnotationLayer {...annotations.layerProps(index + 1)} />,
                section,
                `annotations-${index + 1}`,
              ),
            )}
        </div>
      </div>

      <ViewerControls>
        <ViewerControlButton
          label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() =>
            setZoom((current) => Math.max(MIN_ZOOM, current / ZOOM_FACTOR))
          }
        >
          <ZoomOut />
        </ViewerControlButton>
        <ViewerControlValue label="Reset zoom" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </ViewerControlValue>
        <ViewerControlButton
          label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() =>
            setZoom((current) => Math.min(MAX_ZOOM, current * ZOOM_FACTOR))
          }
        >
          <ZoomIn />
        </ViewerControlButton>
        {/* Re-measures the panel, which after a resize is no longer the same
            thing as resetting the zoom. As in the PDF viewer. */}
        <ViewerControlButton label="Fit to panel" onClick={fitToPanel}>
          <Maximize />
        </ViewerControlButton>
      </ViewerControls>
    </div>
  );
}
