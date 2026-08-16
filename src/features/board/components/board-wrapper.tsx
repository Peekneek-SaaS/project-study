"use client";

import { useMemo } from "react";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { Spinner } from "@/components/ui/spinner";
import { BoardSaveBadge } from "@/features/board/components/board-save-badge";
import { useBoardAutosave } from "@/features/board/hooks/use-board-autosave";
import { useTRPC } from "@/trpc/client";

// Excalidraw ships its own stylesheet and is unusable without it: the canvas
// turns up, and none of the chrome around it does.
import "@excalidraw/excalidraw/index.css";

/**
 * One board, drawable and saving.
 *
 * `initialData` is read once, when Excalidraw mounts, and is not a prop it
 * watches — so the scene has to be in hand before it renders, hence the gate
 * below rather than a fallback passed through. The page prefetches the board,
 * so in practice this resolves from the cache on the first paint.
 *
 * There is no theme object to hand over the way Clerk takes one; Excalidraw
 * takes a single word and does the rest through CSS variables. `custom-styles`
 * is where this app answers those — see `globals.css`.
 */
const BoardWrapper: React.FC<{ boardId: string }> = ({ boardId }) => {
  // `resolvedTheme` rather than `theme`, which can be "system" — a value
  // Excalidraw has no reading of, and would fall back to light on.
  const { resolvedTheme } = useTheme();

  const UIOptions = {
    canvasActions: {
      changeViewBackgroundColor: false,
      clearCanvas: false,
      loadScene: false,
    },
  };

  const trpc = useTRPC();
  const { data: board, isPending } = useQuery(
    trpc.board.get.queryOptions({ id: boardId }),
  );

  const { handleChange, state } = useBoardAutosave(boardId);

  // Memoised against the fetched board rather than rebuilt each render: it is
  // only read at mount, but a new object every render would still be handed to
  // a component that has no reason to see one.
  const initialData = useMemo<ExcalidrawInitialDataState | null>(() => {
    if (!board) return null;

    // Written by `serializeAsJSON`, read back as-is — Excalidraw restores what
    // it recognises and fills in the rest, which is what makes an empty
    // `{ elements: [] }` a valid starting scene. The casts are the one place a
    // `StoredScene` is claimed to be Excalidraw's; see that type for why it
    // travels as something plainer.
    const snapshot = board.snapshot;
    return {
      elements: (snapshot?.elements ??
        []) as ExcalidrawInitialDataState["elements"],
      appState: (snapshot?.appState ??
        {}) as ExcalidrawInitialDataState["appState"],
      files: snapshot?.files as ExcalidrawInitialDataState["files"],
      scrollToContent: true,
    };
  }, [board]);

  if (isPending || !initialData) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="custom-styles relative min-h-0 flex-1">
      <Excalidraw
        initialData={initialData}
        onChange={handleChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        renderTopRightUI={() => {
          return <BoardSaveBadge state={state} />;
        }}
        UIOptions={UIOptions}
      />

      {/* Above the canvas but out of the toolbars' way — Excalidraw owns the
          top and the left, and leaves the bottom-right corner clear. */}
      <div className="pointer-events-none absolute sm: md:right-1/2 md:left-1/2 md:bottom-4 z-10 w-fit"></div>
    </div>
  );
};

export default BoardWrapper;
