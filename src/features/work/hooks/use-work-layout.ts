"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_PIP_CORNER,
  DEFAULT_WORK_TAB,
  isPipCorner,
  isWorkTab,
  type PipCorner,
  type WorkTab,
} from "@/features/work/types";

/**
 * How a work page is arranged, remembered between visits.
 *
 * One key for the whole app rather than one per document: the arrangement is a
 * working habit — someone who reads with the document minimised reads every
 * document that way — and per-document keys would mean re-establishing it on
 * each new upload, plus a `localStorage` that grows with the drive.
 */
const STORAGE_KEY = "work-layout";

export interface WorkLayout {
  /** Whether the document panel is on screen at all. */
  documentOpen: boolean;
  /** Whether the sections panel is on screen at all. */
  sectionsOpen: boolean;
  /** Document reduced to a floating window over the sections. */
  minimized: boolean;
  corner: PipCorner;
  tab: WorkTab;
}

const DEFAULT_LAYOUT: WorkLayout = {
  documentOpen: true,
  sectionsOpen: true,
  minimized: false,
  corner: DEFAULT_PIP_CORNER,
  tab: DEFAULT_WORK_TAB,
};

/**
 * Reads a stored layout back, field by field.
 *
 * Every value is checked rather than the object being trusted whole: this is
 * `localStorage`, which any earlier version of this app — or the user's own
 * devtools — may have written. A single unrecognised tab name would otherwise
 * select a `TabsContent` that does not exist and render an empty panel with no
 * way to tell why.
 */
function parseLayout(raw: string | null): WorkLayout {
  if (!raw) return DEFAULT_LAYOUT;

  try {
    const stored = JSON.parse(raw) as Partial<WorkLayout>;
    return {
      documentOpen:
        typeof stored.documentOpen === "boolean"
          ? stored.documentOpen
          : DEFAULT_LAYOUT.documentOpen,
      sectionsOpen:
        typeof stored.sectionsOpen === "boolean"
          ? stored.sectionsOpen
          : DEFAULT_LAYOUT.sectionsOpen,
      minimized:
        typeof stored.minimized === "boolean"
          ? stored.minimized
          : DEFAULT_LAYOUT.minimized,
      corner: isPipCorner(stored.corner) ? stored.corner : DEFAULT_LAYOUT.corner,
      tab: isWorkTab(stored.tab) ? stored.tab : DEFAULT_LAYOUT.tab,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * `localStorage`, as something React can subscribe to.
 *
 * A store rather than state in the hook, because that is what it actually is —
 * a value living outside React that this app is one reader of. Written this way
 * it needs no effect to load and no effect to save, and two work pages open in
 * two tabs agree with each other, which the `storage` event below is what
 * makes true.
 *
 * The snapshot is cached because `useSyncExternalStore` compares snapshots by
 * identity: parsing on every call would hand back a new object each time and
 * spin forever.
 */
let cache: WorkLayout | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): WorkLayout {
  if (cache) return cache;
  try {
    cache = parseLayout(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage refused outright — private browsing, a blocked origin. The
    // defaults are a working page, so this is not worth surfacing.
    cache = DEFAULT_LAYOUT;
  }
  return cache;
}

/**
 * What the server renders, and what the client hydrates against.
 *
 * A constant, so both passes produce the same HTML. React then re-renders with
 * the real snapshot immediately afterwards — which is the whole reason this is
 * a `useSyncExternalStore` rather than a read during render.
 */
function getServerSnapshot(): WorkLayout {
  return DEFAULT_LAYOUT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab wrote the key. `storage` fires only in the tabs that did *not*
  // make the change, so this never doubles up with a local write.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = null;
    for (const notify of listeners) notify();
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function writeLayout(next: WorkLayout) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Full, or blocked. The page works; only the memory of it is lost.
  }
  for (const notify of listeners) notify();
}

export function useWorkLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const patch = useCallback(
    (next: Partial<WorkLayout>) => writeLayout({ ...getSnapshot(), ...next }),
    [],
  );

  /**
   * Puts the document into its floating window.
   *
   * Opens the sections panel on the way, because the two states are the same
   * intent: minimising is asking for the canvas to have the room, and doing it
   * with the sections closed would leave a floating document over nothing.
   */
  const minimize = useCallback(
    () => patch({ minimized: true, sectionsOpen: true, documentOpen: true }),
    [patch],
  );

  const restore = useCallback(() => patch({ minimized: false }), [patch]);

  /**
   * Closing the last panel is refused rather than allowed to empty the page.
   *
   * The buttons are also disabled at that point, so this is the second guard —
   * it catches anything that calls straight in.
   */
  const setDocumentOpen = useCallback(
    (open: boolean) => {
      const current = getSnapshot();
      if (!open && !current.sectionsOpen) return;
      // A closed document panel has nothing to minimise; leaving `minimized`
      // set would restore into a panel that is no longer there.
      patch({ documentOpen: open, minimized: open ? current.minimized : false });
    },
    [patch],
  );

  const setSectionsOpen = useCallback(
    (open: boolean) => {
      const current = getSnapshot();
      if (!open && !current.documentOpen) return;
      // The floating document only makes sense over something; closing what it
      // floats over puts it back in its panel.
      patch({ sectionsOpen: open, minimized: open ? current.minimized : false });
    },
    [patch],
  );

  return {
    ...layout,
    setTab: useCallback((tab: WorkTab) => patch({ tab }), [patch]),
    setCorner: useCallback((corner: PipCorner) => patch({ corner }), [patch]),
    setDocumentOpen,
    setSectionsOpen,
    minimize,
    restore,
  };
}
