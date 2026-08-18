import { create } from "zustand";

/**
 * Text on its way into the composer from somewhere else on the page.
 *
 * The composer owns what is typed in it — a plain `useState` inside
 * `ChatComposer` — which is right for a box nobody else writes to, and wrong
 * the moment something does. Lifting that state to every caller so one feature
 * can prepend to it would make three surfaces manage a value they have no other
 * interest in.
 *
 * So the traffic goes the other way: a sender leaves text here, and the
 * composer picks it up. The composer stays the only thing that knows how its
 * own input works, and a second sender — a "quote this", a template, a
 * suggestion — needs nothing new.
 *
 * Deliberately not persisted. This is a handoff that lives exactly as long as
 * the gesture that started it; text still sitting here after a reload would
 * appear in the box for no reason the user could account for.
 */
interface ComposerInsertStore {
  /** Waiting to be picked up, or `null` when nothing is. */
  pending: string | null;
  /** Leaves text for the composer. Replaces anything not yet collected. */
  insert: (text: string) => void;
  /**
   * Reads the pending text and clears it in the same call.
   *
   * One function rather than a read and a clear, because the two must not be
   * separable: React runs effects twice in development, and a version that
   * returned the text without consuming it would paste everything twice.
   */
  take: () => string | null;
}

export const useComposerInsertStore = create<ComposerInsertStore>(
  (set, get) => ({
    pending: null,
    insert: (text) => set({ pending: text }),
    take: () => {
      const { pending } = get();
      if (pending === null) return null;
      set({ pending: null });
      return pending;
    },
  }),
);
