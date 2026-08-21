"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  PIP_DEFAULT_HEIGHT,
  PIP_DEFAULT_WIDTH,
  PIP_MIN_HEIGHT,
  PIP_MIN_WIDTH,
  type PipSize,
} from "@/features/work/lib/pip-geometry";
import {
  DEFAULT_NOTES_TAB,
  DEFAULT_PIP_CORNER,
  DEFAULT_WORK_TAB,
  isNotesTab,
  isPipCorner,
  isWorkTab,
  type NotesTab,
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
  /**
   * How big the floating window was left, in px.
   *
   * Kept beside the corner because it is the other half of the same answer —
   * where the window is and how big it is — and remembered for the same reason:
   * someone who drags it out to read a slide properly should not have to do it
   * again on the next document.
   *
   * Only ever a floor is enforced here. The ceiling belongs to whatever the
   * window is floating over, which this has no way of knowing and which changes
   * as the page is resized, so it is applied where that is measured — see
   * `DocumentPip`.
   */
  pipSize: PipSize;
  tab: WorkTab;
  /**
   * Which of the notes panel's two lists was open last.
   *
   * Here rather than in the panel's own state, and for the reason the outer tab
   * is here: a reader who works in annotations comes back to annotations. It
   * rides in the same record because it is the same question one level down —
   * which is also what gives it the cross-tab agreement and the checked read
   * that a `useState` in the panel could not have.
   */
  notesTab: NotesTab;
}

const DEFAULT_LAYOUT: WorkLayout = {
  documentOpen: true,
  sectionsOpen: true,
  minimized: false,
  corner: DEFAULT_PIP_CORNER,
  pipSize: { width: PIP_DEFAULT_WIDTH, height: PIP_DEFAULT_HEIGHT },
  tab: DEFAULT_WORK_TAB,
  notesTab: DEFAULT_NOTES_TAB,
};

/**
 * Reads a stored size back.
 *
 * As with every other field, this is `localStorage` and so is not to be
 * trusted: a `NaN`, a negative or a missing half would render a window with no
 * width, which is a document that has vanished with no way to get it back.
 */
function parsePipSize(value: unknown): PipSize {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_LAYOUT.pipSize;
  }

  const { width, height } = value as Partial<PipSize>;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return DEFAULT_LAYOUT.pipSize;
  }

  return {
    width: Math.max(PIP_MIN_WIDTH, width),
    height: Math.max(PIP_MIN_HEIGHT, height),
  };
}

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
      pipSize: parsePipSize(stored.pipSize),
      tab: isWorkTab(stored.tab) ? stored.tab : DEFAULT_LAYOUT.tab,
      notesTab: isNotesTab(stored.notesTab)
        ? stored.notesTab
        : DEFAULT_LAYOUT.notesTab,
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
   * Puts the document back on screen, whatever state it was left in.
   *
   * The counterpart to `showSections`, and it exists for the citation links: a
   * link that lands on page 5 of a document the reader had minimised or closed
   * would appear to do nothing at all. One patch rather than an open followed by
   * a restore, so there is no render in between showing the panel in the wrong
   * state.
   */
  const showDocument = useCallback(
    () => patch({ documentOpen: true, minimized: false }),
    [patch],
  );

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

  /**
   * Brings the board and notes back on the section asked for.
   *
   * One patch rather than a `setTab` followed by a `setSectionsOpen`: those are
   * two writes to the same store, and the render between them would open the
   * panel on the tab the user did not press before switching to the one they
   * did. No guard, unlike the setters above — opening a panel can never be what
   * empties the page.
   */
  const showSections = useCallback(
    (tab: WorkTab) => patch({ sectionsOpen: true, tab }),
    [patch],
  );

  return {
    ...layout,
    setTab: useCallback((tab: WorkTab) => patch({ tab }), [patch]),
    setNotesTab: useCallback(
      (notesTab: NotesTab) => patch({ notesTab }),
      [patch],
    ),
    showSections,
    setCorner: useCallback((corner: PipCorner) => patch({ corner }), [patch]),
    /**
     * Written once a resize is over rather than on every pointer move — the
     * same reason the panel split is saved on `onLayoutChanged`: a drag is a
     * hundred frames, and each one of these is a `JSON.stringify` into
     * `localStorage` and a re-render of every reader.
     */
    setPipSize: useCallback((pipSize: PipSize) => patch({ pipSize }), [patch]),
    setDocumentOpen,
    setSectionsOpen,
    minimize,
    restore,
    showDocument,
  };
}
