import { Settings, type LucideIcon } from "lucide-react";

/**
 * The panels the settings dialog can show.
 *
 * One list, so the sidebar, the mobile tabs and the store all agree on what
 * exists and what each is called. Adding a panel is an entry here plus a
 * component in `settings-modal.tsx`; nothing else has to learn about it.
 *
 * The ids are kept separate from the copy for the same reason the paste targets
 * are: the id is what the store holds and what a caller asks to be opened on,
 * so it stays a plain string rather than anything carrying a component with it.
 */
export interface SettingsSectionMeta {
  id: string;
  label: string;
  icon: LucideIcon;
  /** The line under the heading, saying what the panel is for. */
  description: string;
}

export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    icon: Settings,
    description: "How the app looks and behaves.",
  },
] as const satisfies readonly SettingsSectionMeta[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

/** The panel a freshly opened dialog lands on. */
export const DEFAULT_SETTINGS_SECTION: SettingsSection = "general";
