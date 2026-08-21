"use client";

import type { ReactNode } from "react";

import { LazyDocxViewer } from "@/features/main/components/lazy-docx-viewer";
import { LazyPdfViewer } from "@/features/main/components/lazy-pdf-viewer";
import { LazyPptxViewer } from "@/features/main/components/lazy-pptx-viewer";
import type { PdfLayout } from "@/features/main/components/pdf-viewer";
import { documentViewerKind } from "@/lib/document-file-types";

/**
 * A document, in whichever viewer reads its format.
 *
 * There are three, because the three formats are read as themselves rather than
 * funnelled through a conversion: `PdfViewer` for PDFs, `DocxViewer` for Word,
 * `PptxViewer` for PowerPoint. This is the one place that choice is made, so
 * the preview page and the work panel cannot end up disagreeing about which
 * files this app can show.
 *
 * `fallback` rather than a built-in empty state: the two callers are saying
 * different things when a file cannot be read. The preview page offers a
 * download, while the work panel points out that the board and notes beside it
 * still work. Both are right in their own frame, so neither is baked in here.
 */
export function DocumentView({
  name,
  url,
  pdfLayout,
  page,
  pageRequestId,
  documentId,
  fallback = null,
}: {
  name: string;
  url: string;
  /**
   * Which document this is, when notes may be written onto it.
   *
   * All three viewers take it. They look nothing alike to a reader, but each
   * one lays its content out as a box per page at a fixed size, scaled by a
   * transform — which is the only thing the anchoring needs. See
   * `useAnnotationSurface` for the contract each of them holds up.
   */
  documentId?: string | null;
  /** Only reaches the PDF viewer; the other two have no such arrangement. */
  pdfLayout?: PdfLayout;
  /**
   * A page to open at, for a citation or a note.
   *
   * All three now, where this used to be PDF-only. The other two turned out to
   * have real pages after all: `docx-preview` runs with `breakPages`, so a Word
   * file renders as a column of paper-sized sections, and a deck's slides are
   * its pages by another name. A page number therefore means something in every
   * viewer, and so does a note anchored to one.
   */
  page?: number | null;
  /** Lets the same page be asked for twice — see `PdfViewer`. */
  pageRequestId?: number;
  fallback?: ReactNode;
}) {
  switch (documentViewerKind(name)) {
    case "pdf":
      return (
        <LazyPdfViewer
          url={url}
          layout={pdfLayout}
          page={page}
          pageRequestId={pageRequestId}
          documentId={documentId}
        />
      );
    case "docx":
      return (
        <LazyDocxViewer
          url={url}
          page={page}
          pageRequestId={pageRequestId}
          documentId={documentId}
        />
      );
    case "pptx":
      return (
        <LazyPptxViewer
          url={url}
          page={page}
          pageRequestId={pageRequestId}
          documentId={documentId}
        />
      );
    default:
      // `.doc` and `.ppt` — see `documentViewerKind` for why those two are not
      // just older spellings of the formats above.
      return <>{fallback}</>;
  }
}
