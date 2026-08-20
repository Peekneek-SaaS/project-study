"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/features/main/lib/settings-sections";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

/**
 * Everything the app can be told about itself, in one dialog.
 *
 * Two shapes of the same thing. On a wide screen the panels are a list down the
 * left and the panel itself fills the rest, which is what settings look like
 * everywhere and what makes a long list of them scannable. On a narrow one that
 * list would take half the dialog to say nothing, so the same panels become
 * tabs across the top — the switch is a layout, not a different navigation
 * model, and both are driven by the one piece of state in `settings-store`.
 *
 * Written as plain nav markup rather than with the `Sidebar` primitives: those
 * need a `SidebarProvider` around them, which brings a `min-h-svh` wrapper and
 * a second ⌘B listener into a dialog that wants neither. What is wanted here is
 * the *shape* of a sidebar, and that is a column of buttons.
 */

/** One row of the settings list, on either axis. */
function SettingsNavButton({
  section,
  isActive,
  onSelect,
}: {
  section: (typeof SETTINGS_SECTIONS)[number];
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      onClick={onSelect}
      data-active={isActive}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md border border-transparent px-3",
        "text-[13px] font-medium tracking-tight text-muted-foreground",
        "transition-colors hover:bg-accent hover:text-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "data-[active=true]:border-primary data-[active=true]:text-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0",
      )}
    >
      <section.icon />
      <span className="truncate">{section.label}</span>
    </Button>
  );
}

/**
 * A labelled row, with its control on the right.
 *
 * The shape every setting takes, so a panel is a list of these rather than a
 * layout re-decided per option.
 */
function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function GeneralSettings() {
  // `theme` rather than `resolvedTheme`: this control is the *choice*, and
  // "System" is one of the answers — reading the resolved value would show
  // "Dark" for a reader who asked to follow their system and happens to be in
  // the dark half of the day, and then quietly change what they had chosen the
  // moment they touched anything else.
  const { theme, setTheme } = useTheme();

  return (
    <SettingsRow
      label="Appearance"
      description="Follow your system, or pick a side."
    >
      <ModeToggle />
    </SettingsRow>
  );
}

export function SettingsModal() {
  const isOpen = useSettingsStore((state) => state.isOpen);
  const section = useSettingsStore((state) => state.section);
  const setSection = useSettingsStore((state) => state.setSection);
  const close = useSettingsStore((state) => state.close);

  // Nothing to draw while closed, and nothing to keep alive either: the panels
  // hold no work in progress, so this stays out of the tree until it is asked
  // for.
  if (!isOpen) return null;

  const active =
    SETTINGS_SECTIONS.find((entry) => entry.id === section) ??
    SETTINGS_SECTIONS[0];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/*
          The dialog's own name is for screen readers only. On screen the
          heading that matters is the panel's — which is what the reader
          actually navigated to, and what the sidebar and the tabs both point
          at.
        */}
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Change how the app looks and behaves.
        </DialogDescription>

        <div className="flex h-[28rem] max-h-[75svh] min-h-0 flex-col md:flex-row">
          {/* The list, on a screen with room for it beside the panel. */}
          <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r bg-sidebar p-2 md:flex">
            {SETTINGS_SECTIONS.map((entry) => (
              <SettingsNavButton
                key={entry.id}
                section={entry}
                isActive={entry.id === active.id}
                onSelect={() => setSection(entry.id)}
              />
            ))}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            {/*
              The same list on a narrow screen, across the top. `Tabs` here is
              the switch and nothing else — the panel below is rendered once for
              both layouts rather than duplicated into `TabsContent`, so there
              is only ever one of each setting on the page.
            */}
            <div className="border-b p-2 md:hidden">
              <Tabs
                value={active.id}
                onValueChange={(value) => setSection(value as SettingsSection)}
              >
                <TabsList variant="custom" className="w-full">
                  {SETTINGS_SECTIONS.map((entry) => (
                    <TabsTrigger key={entry.id} value={entry.id}>
                      <entry.icon />
                      {entry.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <header className="border-b pb-3">
                <h2 className="text-base font-semibold">{active.label}</h2>
                <p className="text-xs text-muted-foreground">
                  {active.description}
                </p>
              </header>

              {active.id === "general" && <GeneralSettings />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
