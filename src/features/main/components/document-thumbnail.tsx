"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FileText, Presentation } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { DriveDocument } from "@/features/main/types";
import { documentViewerKind, isSlides } from "@/lib/document-file-types";
import { documentFilePath } from "@/lib/document-links";

/** The placeholder all three renderers show while they work. */
const thumbnailSkeleton = () => (
  <Skeleton className="h-full w-full rounded-none" />
);

/**
 * Each renderer is a large browser-only dependency, and a card only ever needs
 * one of them — so they are split rather than bundled together. A drive of PDFs
 * never downloads the PowerPoint renderer, and vice versa.
 */
const LazyPdfThumbnail = dynamic(
  () =>
    import("@/features/main/components/pdf-thumbnail").then(
      (mod) => mod.PdfThumbnail,
    ),
  { ssr: false, loading: thumbnailSkeleton },
);

const LazyDocxThumbnail = dynamic(
  () =>
    import("@/features/main/components/docx-thumbnail").then(
      (mod) => mod.DocxThumbnail,
    ),
  { ssr: false, loading: thumbnailSkeleton },
);

const LazyPptxThumbnail = dynamic(
  () =>
    import("@/features/main/components/pptx-thumbnail").then(
      (mod) => mod.PptxThumbnail,
    ),
  { ssr: false, loading: thumbnailSkeleton },
);

/** Grid cards run to the edge of the screen; start a little before that. */
const PRELOAD_MARGIN_PX = 300;

/**
 * What a document looks like on its card.
 *
 * Every format the app can read gets its real first page: PDFs their first
 * page, Word documents theirs, decks their opening slide. The icon is left for
 * `.doc` and `.ppt`, which no viewer here can open — better an honest
 * placeholder than a blank rectangle.
 *
 * Nothing loads until the card is near the viewport: the file route does not
 * serve ranges, so a thumbnail costs the whole document, and a folder of them
 * would otherwise all download at once.
 */
export function DocumentThumbnail({ doc }: { doc: DriveDocument }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isNearViewport) return;

    // Measured once up front, because an observer reports for the first time on
    // a later frame — and on a fresh load every card on screen is sitting in
    // that gap waiting to be told what it can already see. The observer is left
    // to the cards this does not answer for.
    const { top, bottom } = element.getBoundingClientRect();
    if (
      top < window.innerHeight + PRELOAD_MARGIN_PX &&
      bottom > -PRELOAD_MARGIN_PX
    ) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsNearViewport(true);
      },
      { rootMargin: `${PRELOAD_MARGIN_PX}px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isNearViewport]);

  const Icon = isSlides(doc.name) ? Presentation : FileText;
  // Nothing to draw until the upload has landed and the row is real.
  const kind = doc.status === "READY" ? documentViewerKind(doc.name) : null;

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {kind === null ? (
        <div className="flex h-full items-center justify-center">
          <Icon className="size-10 text-muted-foreground/40" />
        </div>
      ) : // A document waiting its turn gets the skeleton it is about to show
      // anyway. The icon would be a third thing to look at on the way to the
      // page — and a wrong one, since this card is not going to keep it.
      !isNearViewport ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : kind === "pdf" ? (
        <LazyPdfThumbnail url={documentFilePath(doc.id)} />
      ) : kind === "docx" ? (
        <LazyDocxThumbnail url={documentFilePath(doc.id)} />
      ) : (
        <LazyPptxThumbnail url={documentFilePath(doc.id)} />
      )}
    </div>
  );
}
