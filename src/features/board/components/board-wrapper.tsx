"use client";

import { useMemo, useState } from "react";
import { Excalidraw, MainMenu, useHandleLibrary } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { LibraryPersistenceAdapter } from "@excalidraw/excalidraw/data/library";
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
 * Hoisted because Excalidraw merges this into its own defaults on every render
 * it sees a new object for, and nothing here depends on props.
 *
 * The three that are off have no meaning in this app: the canvas background is
 * the app's, there is no file on disk to save back to, and a scene arrives from
 * the database rather than from a picker. `clearCanvas` is off because it is
 * one click and an autosave away from an empty board.
 *
 * `toggleTheme` is on and explicit — the default is `null`, which reads as
 * "decide for me", and the menu below renders that item itself.
 */
const UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: true,
  },
};

const LIBRARY_STORAGE_KEY = "study:excalidraw-library";

/**
 * Where "add to library" actually puts things.
 *
 * Excalidraw holds library items in memory and tells the host about them; it
 * does not keep them anywhere. Without an adapter the panel works, the shape
 * appears in it, and the whole library is gone on the next reload — which is
 * worse than not offering the feature, because it looks like it saved.
 *
 * Local storage rather than the database, which is the tradeoff to know about:
 * a library belongs to a browser here, not to the signed-in user, so it does
 * not follow anyone to a second device. Boards are in Postgres and this is not,
 * so this is the one piece of a board's world that does not sync. Moving it
 * needs a table and a router, not a change here — the adapter is the seam.
 *
 * Module scope keeps the object identity stable across renders, which
 * `useHandleLibrary` wants; the bodies only run inside its effects, so nothing
 * touches `localStorage` during SSR.
 */
const libraryAdapter: LibraryPersistenceAdapter = {
  load: () => {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // Corrupt or from an older shape. Losing a library is bad; refusing to
      // load the board because of one is worse, so this starts empty instead
      // of throwing and lets the next save overwrite it.
      return null;
    }
  },
  save: (data) => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(data));
  },
};

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
  // Excalidraw has no reading of, and would fall back to light on. `theme` is
  // still wanted alongside it, for the menu item further down: that one is a
  // control rather than a rendering, so it wants the user's actual choice,
  // "system" included.
  const { resolvedTheme, theme, setTheme } = useTheme();

  // Excalidraw hands its API over through a callback rather than a ref, and
  // `useHandleLibrary` needs it to push loaded items back in. Null until the
  // canvas below mounts, which the hook expects and sits out.
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  // Above the loading gate, as every hook has to be. It does nothing at all
  // while `excalidrawAPI` is null, so running early costs nothing.
  useHandleLibrary({ excalidrawAPI, adapter: libraryAdapter });

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

  // `!board` is redundant against `!initialData` — the memo returns null on
  // exactly that condition — but it is what narrows `board` for the `name`
  // below, and the two cannot drift apart while it is written this way.
  if (isPending || !board || !initialData) {
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
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        // The name an exported PNG or SVG lands under. Without it every board
        // exports as Excalidraw's own placeholder, whatever the board is called
        // in the app.
        name={board.name}
        autoFocus
        // Turns off the three AI entry points Excalidraw ships: "Text to
        // diagram", the "convert to code" button on a selected frame, and the
        // wire-up point for its dialog. They call excalidraw.com's own
        // endpoints, which this app has no account with, so they were never
        // going to work here. Also the supported half of clearing out the
        // toolbar's "Generate" section — see the CSS note for the other half.
        aiEnabled={false}
        renderTopRightUI={() => {
          return <BoardSaveBadge state={state} />;
        }}
        UIOptions={UI_OPTIONS}
      >
        {/*
          Supplying a menu replaces Excalidraw's, which is the point: the
          default one is half product tour — Excalidraw+, GitHub, Discord,
          "sign up" — and no amount of recolouring makes that read as part of
          this app. What is left is the four items that do something here.

          `ToggleTheme` is wired through to next-themes rather than left to
          Excalidraw's own state, which the `theme` prop above overrides
          anyway; without this the item would move and then snap back. It takes
          "system" natively, so the three choices line up exactly with the
          ones in the app's own theme switcher.
        */}
        <MainMenu>
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme
            allowSystemTheme
            theme={(theme ?? "system") as "light" | "dark" | "system"}
            onSelect={setTheme}
          />
        </MainMenu>
      </Excalidraw>

      {/* Above the canvas but out of the toolbars' way — Excalidraw owns the
          top and the left, and leaves the bottom-right corner clear. */}
      <div className="pointer-events-none absolute sm: md:right-1/2 md:left-1/2 md:bottom-4 z-10 w-fit"></div>
    </div>
  );
};

export default BoardWrapper;
