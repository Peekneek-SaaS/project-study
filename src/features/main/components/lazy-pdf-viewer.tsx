"use client";

import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

/**
 * The PDF viewer, loaded only when one is actually opened.
 *
 * pdf.js reaches for browser APIs the moment it loads, so it cannot be
 * server-rendered — and it is a large dependency nobody who never opens a
 * document should pay for. Kept here so the preview page (a Server Component)
 * and the preview modal share one boundary.
 */
export const LazyPdfViewer = dynamic(
  () =>
    import("@/features/main/components/pdf-viewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);
