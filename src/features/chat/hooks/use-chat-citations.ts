"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_CITATIONS } from "@/lib/ai/types";

/**
 * Whether answers should carry citations, remembered between visits.
 *
 * Written the same way as `use-chat-provider`, and for the same reasons: no
 * effect to load it, none to save it, two tabs agree with each other, and the
 * universal chat and a document's own panel read one value without anything
 * having to wire them together. Read that file first — this is the same shape
 * with a boolean in it.
 *
 * One key for the whole app, again like the provider. "I do not want a
 * footnote on every sentence" is a statement about how someone likes to be
 * answered, not about the document they happen to have open, and a preference
 * that reset when they opened a different file would have to be set over and
 * over.
 *
 * The default itself lives in `@/lib/ai/types` next to the provider default,
 * because the worker needs the same answer when a turn arrives without the flag
 * — see the note on `DEFAULT_CITATIONS` there.
 */
const STORAGE_KEY = "chat-citations";

let cache: boolean | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (cache !== null) return cache;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Both settings are read explicitly, and anything else — never set, or a
    // value written by some older version of this app — falls through to the
    // default. Written this way rather than as "off means off, otherwise the
    // default" so that changing which way the default points cannot silently
    // reinterpret what a stored value meant.
    cache = stored === "on" ? true : stored === "off" ? false : DEFAULT_CITATIONS;
  } catch {
    // Storage refused outright — private browsing, a blocked origin. A working
    // chat with citations is not worth surfacing an error over.
    cache = DEFAULT_CITATIONS;
  }

  return cache;
}

/**
 * What the server renders and the client hydrates against — a constant, so both
 * passes produce the same markup and React can correct it immediately after.
 */
function getServerSnapshot(): boolean {
  return DEFAULT_CITATIONS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab flipped the toggle. `storage` fires only in the tabs that did
  // *not* make the change, so this never doubles up with a local write.
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

export function useChatCitations() {
  const citations = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setCitations = useCallback((next: boolean) => {
    cache = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Full, or blocked. The choice holds for this session; only the memory
      // of it is lost.
    }
    for (const notify of listeners) notify();
  }, []);

  return [citations, setCitations] as const;
}
