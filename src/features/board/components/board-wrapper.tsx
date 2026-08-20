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
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BoardSaveButton } from "@/features/board/components/board-save-button";
import { useBoardAutosave } from "@/features/board/hooks/use-board-autosave";
import {
  readBoardViewport,
  useBoardViewport,
} from "@/features/board/hooks/use-board-viewport";
import { BOARDS_PATH } from "@/features/board/types";
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

  const { handleChange, state, saveNow } = useBoardAutosave(boardId);
  const rememberViewport = useBoardViewport(boardId);

  /**
   * Where this board was last being looked at, read once.
   *
   * In a state initialiser rather than during the render or in an effect: it
   * has to be in hand before `initialData` is built — Excalidraw reads that at
   * mount and never again — and it must not be re-read afterwards, or a
   * remount mid-session would drag the canvas back to wherever the debounce
   * had last got to.
   */
  const [initialViewport] = useState(() => readBoardViewport(boardId));

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
      appState: {
        ...(snapshot?.appState ?? {}),
        // Laid over the stored scene rather than merged into it: the scene is
        // the drawing and this is the reader's place in it, and the two are
        // saved in different places for the reasons `useBoardViewport` gives.
        ...(initialViewport && {
          scrollX: initialViewport.scrollX,
          scrollY: initialViewport.scrollY,
          zoom: { value: initialViewport.zoom },
        }),
      } as ExcalidrawInitialDataState["appState"],
      files: snapshot?.files as ExcalidrawInitialDataState["files"],
      // Only when there is nowhere to go back to. `scrollToContent` runs after
      // the rest of `initialData` is restored and centres the drawing, so
      // leaving it on would overwrite the scroll offsets just set above — the
      // board would open on the middle of the work every time rather than
      // where it was left.
      scrollToContent: !initialViewport,
    };
  }, [board, initialViewport]);

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
    /*
      `group/board` is what lets the chrome below follow Excalidraw's own idea
      of a small screen rather than guess at one. Excalidraw decides between its
      desktop and mobile layouts from the width of *this* container — not the
      viewport, which is a different number whenever the sidebar is open — and
      says so by putting `excalidraw--mobile` on its root. A `:has()` off this
      group reads that class, so there is one breakpoint on the page and it is
      Excalidraw's.
    */
    <div className="group/board custom-styles relative min-h-0 flex-1">
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={setExcalidrawAPI}
        // Two readers of the same report, each ignoring what the other wants:
        // the autosave takes the elements and skips anything that only moved
        // the view, and the viewport takes the scroll and the zoom and skips
        // everything else.
        onChange={(elements, appState, files) => {
          handleChange(elements, appState, files);
          rememberViewport(appState);
        }}
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
        /*
          The right-hand corner: the save state, and on a small screen the way
          out beside it.

          Excalidraw calls this with `isMobile` and — importantly — puts what it
          returns *inside* its own top bar, in the same row as the toolbar. So
          on a phone the back button belongs here, laid out by Excalidraw, where
          it cannot land on top of anything; the absolutely positioned one below
          is for the desktop layout, where the top row is a three-column grid
          with room to spare.

          `pointer-events-auto` because the wrapper Excalidraw drops this into
          sets `pointer-events: none !important` — fine for the label this used
          to be, fatal for a button.
        */
        renderTopRightUI={(isMobile) => (
          <div className="pointer-events-auto flex items-center gap-2">
            {isMobile && (
              <Button
                asChild
                variant="outline"
                size="icon"
                className="bg-card/90 shadow-sm backdrop-blur"
              >
                <Link
                  href={BOARDS_PATH}
                  aria-label="Back to boards"
                  title="Back to boards"
                >
                  <ArrowLeft />
                </Link>
              </Button>
            )}

            <BoardSaveButton state={state} onSave={() => void saveNow()} />
          </div>
        )}
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

      {/*
        The way out, beside the menu it sits next to.

        Excalidraw's desktop top row is a three-column grid with 2rem of gap,
        and the left column holds one thing: the hamburger, 2.25rem wide, inset
        by the editor's own 1rem of padding. So the space immediately to its
        right is free at every width that layout is drawn at, and 3.75rem clears
        the menu with a gap to spare.

        Gone the moment Excalidraw switches to its mobile layout, where that
        same spot is the shape toolbar. The copy in the top-right island takes
        over there — one of the two is on screen, never both.
      */}
      <Button
        asChild
        variant="outline"
        size="icon"
        className="absolute top-4 left-[3.75rem] z-10 bg-card/90 shadow-sm backdrop-blur group-has-[.excalidraw--mobile]/board:hidden"
      >
        <Link
          href={BOARDS_PATH}
          aria-label="Back to boards"
          title="Back to boards"
        >
          <ArrowLeft />
        </Link>
      </Button>

      {/*
        The board's name, along the bottom.

        Centred, because the bottom corners are taken — the zoom and the undo
        pair on the left, the help button on the right — and the middle of that
        edge is the one strip of the canvas nothing of Excalidraw's is drawn
        into. `pointer-events-none` because it is a label and the canvas beneath
        it is for drawing on; a name that swallowed strokes would be worse than
        no name at all.

        The mobile layout puts a full-width bar along that edge, which is what
        the raised offset clears. It is a label rather than a control, so it is
        allowed to sit under the taller version of that bar — the one that opens
        when a shape is selected — rather than have a second position for it.
      */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 group-has-[.excalidraw--mobile]/board:bottom-24">
        <span className="block max-w-[min(24rem,60vw)] truncate rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
          {board.name}
        </span>
      </div>
    </div>
  );
};

export default BoardWrapper;
