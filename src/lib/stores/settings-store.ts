// lib/stores/settings-store.ts
import { create } from "zustand";

import {
  DEFAULT_SETTINGS_SECTION,
  type SettingsSection,
} from "@/features/main/lib/settings-sections";

/**
 * The settings dialog, kept out of `modal-store` deliberately.
 *
 * That store holds one modal at a time with one payload, and this one has a
 * second piece of state that outlives being open: which panel you were last
 * looking at. Reopening settings should put you back where you were rather than
 * at the top of the list, and a payload cleared on close cannot do that.
 *
 * The same reasoning as `search-store`, which is separate for its own reasons.
 */
interface SettingsStore {
  isOpen: boolean;
  /**
   * The panel on screen. Remembered across opens — see above — and only ever
   * one of the sections named in `settings-sections`.
   */
  section: SettingsSection;
  /**
   * Opens the dialog, optionally on a particular panel.
   *
   * The argument is what lets something specific — a "change your theme" link,
   * say — point straight at the panel that answers it, instead of opening the
   * dialog and leaving the reader to find it.
   */
  open: (section?: SettingsSection) => void;
  close: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  section: DEFAULT_SETTINGS_SECTION,
  open: (section) => set(section ? { isOpen: true, section } : { isOpen: true }),
  close: () => set({ isOpen: false }),
  setSection: (section) => set({ section }),
}));
