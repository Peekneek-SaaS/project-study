"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_AI_PROVIDER, isAiProvider, type AiProvider } from "@/lib/ai/types";

/**
 * Which model the user last chose, remembered between visits.
 *
 * Written as an external store rather than as state in a provider, for the same
 * reasons `use-work-layout` is: it needs no effect to load and none to save, two
 * tabs agree with each other, and the composer on a document page and the one
 * on the chat page read the same value without anything having to wire them
 * together.
 *
 * One key for the whole app. The picker expresses a preference about how the
 * user likes to be answered, which is not something that should reset because
 * they opened a different document.
 */
const STORAGE_KEY = "chat-provider";

let cache: AiProvider | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): AiProvider {
  if (cache) return cache;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Checked rather than trusted: an older version of this app may have
    // written a provider that no longer exists, and an unknown name would be
    // sent to the server and rejected on every single message.
    cache = isAiProvider(stored) ? stored : DEFAULT_AI_PROVIDER;
  } catch {
    // Storage refused outright — private browsing, a blocked origin. The
    // default is a working chat, so this is not worth surfacing.
    cache = DEFAULT_AI_PROVIDER;
  }

  return cache;
}

/**
 * What the server renders and the client hydrates against — a constant, so both
 * passes produce the same markup and React can correct it immediately after.
 */
function getServerSnapshot(): AiProvider {
  return DEFAULT_AI_PROVIDER;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab changed the picker. `storage` fires only in the tabs that did
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

export function useChatProvider() {
  const provider = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setProvider = useCallback((next: AiProvider) => {
    cache = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Full, or blocked. The choice holds for this session; only the memory
      // of it is lost.
    }
    for (const notify of listeners) notify();
  }, []);

  return [provider, setProvider] as const;
}
