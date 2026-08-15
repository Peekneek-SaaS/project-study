"use client";

import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

/**
 * The client boundary Excalidraw needs to be loaded across.
 *
 * It reaches for the DOM as it loads and does not server-render, so it arrives
 * through a dynamic import with prerendering turned off — and `ssr: false` is
 * only honoured inside a Client Component. Asking for it from a Server
 * Component is an error rather than a no-op, which is the whole reason this
 * file exists apart from the view that renders it.
 */
const ExcalidrawWrapper = dynamic(
  async () => (await import("../components/board-wrapper")).default,
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

export default function BoardDynamic({ boardId }: { boardId: string }) {
  return <ExcalidrawWrapper boardId={boardId} />;
}
