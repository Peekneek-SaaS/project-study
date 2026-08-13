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
const PRELOAD_MARGIN = "300px";

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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsNearViewport(true);
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isNearViewport]);

  const Icon = isSlides(doc.name) ? Presentation : FileText;
  // Nothing to draw until the upload has landed and the row is real.
  const canPreview = doc.status === "READY" && isPdf(doc.name);

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {canPreview && isNearViewport ? (
        <LazyPdfThumbnail url={documentFilePath(doc.id)} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Icon className="size-10 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
