"use client";

import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

/**
 * The PowerPoint viewer, loaded only when a .pptx is actually opened.
 *
 * The heaviest of the three boundaries — `pptx-preview` carries JSZip and
 * echarts, the latter only so that charts embedded in slides draw — which is
 * exactly why it is behind one.
 */
export const LazyPptxViewer = dynamic(
  () =>
    import("@/features/main/components/pptx-viewer").then(
      (mod) => mod.PptxViewer,
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
