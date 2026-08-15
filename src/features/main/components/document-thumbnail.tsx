"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FileText, Presentation } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { DriveDocument } from "@/features/main/types";
import { isPdf, isSlides } from "@/lib/document-file-types";
import { documentFilePath } from "@/lib/document-links";

/**
 * pdf.js reaches for browser APIs the moment it loads and is a large dependency
 * — nobody browsing in list view should pay for it, so it arrives with the
 * first card that actually needs it.
 */
const LazyPdfThumbnail = dynamic(
  () =>
    import("@/features/main/components/pdf-thumbnail").then(
      (mod) => mod.PdfThumbnail,
    ),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> },
);

/** Grid cards run to the edge of the screen; start a little before that. */
const PRELOAD_MARGIN_PX = 300;

/**
 * What a document looks like on its card.
 *
 * PDFs get their real first page. Word and PowerPoint have no renderer here, so
 * they get their icon — better an honest placeholder than a blank rectangle.
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
  const canPreview = doc.status === "READY" && isPdf(doc.name);

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {canPreview ? (
        // A PDF waiting its turn gets the skeleton it is about to show anyway.
        // The icon would be a third thing to look at on the way to the page —
        // and a wrong one, since this card is not going to keep it.
        isNearViewport ? (
          <LazyPdfThumbnail url={documentFilePath(doc.id)} />
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )
      ) : (
        <div className="flex h-full items-center justify-center">
          <Icon className="size-10 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
