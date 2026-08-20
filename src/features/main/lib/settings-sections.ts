import {
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

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
  // Clerk's account portal, split the way Clerk itself splits it. Its two pages
  // are two panels here rather than one, because a single panel would be nine
  // sections deep in a dialog this tall and because the sidebar already exists
  // to do exactly this kind of dividing.
  //
  // The copy stays vague about what is in each: the sections are Clerk's, and
  // which of them appear — usernames, passkeys, connected accounts — depends on
  // what the instance has switched on, so naming one would be a promise this
  // file cannot keep.
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    description: "Your profile and how you sign in.",
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    description: "Passwords, passkeys and where you are signed in.",
  },
] as const satisfies readonly SettingsSectionMeta[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

/** The panel a freshly opened dialog lands on. */
export const DEFAULT_SETTINGS_SECTION: SettingsSection = "general";
