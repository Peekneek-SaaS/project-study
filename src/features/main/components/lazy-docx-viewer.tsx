"use client";

import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

/**
 * The Word viewer, loaded only when a .docx is actually opened.
 *
 * Same boundary as `LazyPdfViewer`, for the same two reasons: `docx-preview`
 * builds real DOM and cannot be server-rendered, and it is weight that nobody
 * who only ever opens PDFs should be made to download.
 */
export const LazyDocxViewer = dynamic(
  () =>
    import("@/features/main/components/docx-viewer").then(
      (mod) => mod.DocxViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);
