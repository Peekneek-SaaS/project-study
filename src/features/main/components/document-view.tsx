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
  fallback = null,
}: {
  name: string;
  url: string;
  /** Only reaches the PDF viewer; the other two have no such arrangement. */
  pdfLayout?: PdfLayout;
  fallback?: ReactNode;
}) {
  switch (documentViewerKind(name)) {
    case "pdf":
      return <LazyPdfViewer url={url} layout={pdfLayout} />;
    case "docx":
      return <LazyDocxViewer url={url} />;
    case "pptx":
      return <LazyPptxViewer url={url} />;
    default:
      // `.doc` and `.ppt` — see `documentViewerKind` for why those two are not
      // just older spellings of the formats above.
      return <>{fallback}</>;
  }
}
