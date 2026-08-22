"use client";

import { useRef } from "react";
import { UNSAFE_PortalProvider, useUser } from "@clerk/nextjs";
import {
  UserProfileAccountPanel,
  UserProfileActiveDevicesSection,
  UserProfileConnectedAccountsSection,
  UserProfileDeleteSection,
  UserProfileEmailSection,
  UserProfileEnterpriseAccountsSection,
  UserProfileMfaSection,
  UserProfilePasskeysSection,
  UserProfilePasswordSection,
  UserProfilePhoneSection,
  UserProfileProfileSection,
  UserProfileProvider,
  UserProfileSecurityPanel,
  UserProfileUsernameSection,
} from "@clerk/ui/experimental";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsagePanel } from "@/features/billing/components/usage-panel";
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
      variant={isActive ? "default" : "ghost"}
      onClick={onSelect}
      data-active={isActive}
      className={cn("flex items-center justify-start p-1")}
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
  return (
    <SettingsRow
      label="Appearance"
      description="Follow your system, or pick a side."
    >
      <ModeToggle themeName />
    </SettingsRow>
  );
}

/**
 * Clerk's account portal, taken apart and re-laid inside this dialog.
 *
 * `<UserProfile />` is the obvious way to do this and the wrong one here: it is
 * a whole page — its own card, its own left-hand nav, its own routed pages —
 * and dropping a page inside a 672px dialog that already has a nav gives you
 * two navs and a card inside a card, which is what it looked like. Nor can the
 * frame be turned off from the outside: `options.elevation: "flush"` is
 * documented as not applying to the profile components, which always render
 * raised (see `elevation` in `@clerk/ui/dist/internal/appearance.d.ts`).
 *
 * The composed API is the same sections without any of that. Each section is
 * still entirely Clerk's — it reads the live user, opens Clerk's own flows, and
 * self-hides when the instance has that attribute switched off, so listing one
 * whose feature is disabled costs nothing — but the page around them is this
 * app's. Clerk's two pages become this dialog's two panels, which is also what
 * keeps either of them short enough to read without scrolling far.
 *
 * They are experimental, and named as such in the import. What that buys is a
 * panel that cannot drift from what Clerk actually supports; what it costs is
 * an API that may move. The blast radius is this file.
 */

/** The panel's own title, which the dialog already draws in its header. */
const HIDE_CLERK_PAGE_TITLE = "[&_.cl-profilePage_>_.cl-header]:hidden";

/** Roughly the shape of a section, so the panel does not jump when Clerk lands. */
function AccountSkeleton() {
  return (
    <div className="space-y-6 pt-2">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/**
 * The provider the sections need, and the one piece of plumbing they cannot see
 * to themselves.
 *
 * `getContainer` is easy to miss. Clerk's modals, drawers and popovers — the
 * add-email flow, the delete-account confirmation — portal to `document.body`
 * by default, and a Radix dialog is modal: it marks everything outside itself
 * inert, so those would render and then refuse to be clicked. Pointing them at
 * a node *inside* the dialog is what keeps them usable, and is what Clerk
 * documents this provider for.
 *
 * It also renders nothing at all until Clerk has a user, hence the skeleton.
 */
function ClerkAccountPanel({
  getContainer,
  children,
}: {
  getContainer: () => HTMLElement | null;
  children: React.ReactNode;
}) {
  const { isLoaded } = useUser();

  if (!isLoaded) return <AccountSkeleton />;

  return (
    <div className={cn("pt-2", HIDE_CLERK_PAGE_TITLE)}>
      <UNSAFE_PortalProvider getContainer={getContainer}>
        <UserProfileProvider>{children}</UserProfileProvider>
      </UNSAFE_PortalProvider>
    </div>
  );
}

/**
 * Who you are, and the addresses you can sign in with.
 *
 * The order is Clerk's own `AccountPage` order, so someone who has met the
 * hosted portal finds the same things in the same places. Web3 is the one
 * section deliberately left out: this app has no wallet story, and the section
 * would only ever offer to start one.
 */
function AccountSettings({
  getContainer,
}: {
  getContainer: () => HTMLElement | null;
}) {
  return (
    <ClerkAccountPanel getContainer={getContainer}>
      <UserProfileAccountPanel>
        <UserProfileProfileSection />
        <UserProfileUsernameSection />
        <UserProfileEmailSection />
        <UserProfilePhoneSection />
        <UserProfileConnectedAccountsSection />
        <UserProfileEnterpriseAccountsSection />
      </UserProfileAccountPanel>
    </ClerkAccountPanel>
  );
}

/** Passwords, second factors, live sessions — and the way out. */
function SecuritySettings({
  getContainer,
}: {
  getContainer: () => HTMLElement | null;
}) {
  return (
    <ClerkAccountPanel getContainer={getContainer}>
      <UserProfileSecurityPanel>
        <UserProfilePasswordSection />
        <UserProfilePasskeysSection />
        <UserProfileMfaSection />
        <UserProfileActiveDevicesSection />
        <UserProfileDeleteSection />
      </UserProfileSecurityPanel>
    </ClerkAccountPanel>
  );
}

export function SettingsModal() {
  const isOpen = useSettingsStore((state) => state.isOpen);
  const section = useSettingsStore((state) => state.section);
  const setSection = useSettingsStore((state) => state.setSection);
  const close = useSettingsStore((state) => state.close);

  // An empty node at the end of the dialog, and nothing else: it exists to be
  // somewhere inside the dialog that Clerk's floating UI can portal into. See
  // `ClerkAccountPanel`.
  const portalRef = useRef<HTMLDivElement>(null);

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
      {/*
        `overflow-hidden` sits on the panels below rather than here, so that the
        Clerk popovers portalled into the node at the bottom of this dialog are
        not clipped by it.
      */}
      {/*
        Wider than the 2xl it was: Clerk's sections lay themselves out against
        the *viewport* width, not their container's, so on a desktop screen they
        take the wide arrangement whatever column they are given — and the
        column left over after the sidebar has to be wide enough to hold it.

        Wider again past `lg`, which is where that arrangement is at its widest:
        3xl less the 13rem sidebar and the panel's own padding left about 32rem
        for a row that wants more, and "Update profile" was the part on the end
        that did not fit.
      */}
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-3xl lg:max-w-4xl">
        {/*
          The dialog's own name, which on a narrow screen is also the only thing
          naming the dialog on screen. It sits in a bar of its own, at the same
          height as the close button and to the left of it — the tabs used to
          start here and ran underneath that button.

          On a wide screen the heading that matters is the panel's, which is
          what the reader navigated to and what the sidebar points at, so this
          one steps back to being read aloud and nothing more.
        */}
        <DialogTitle className="flex h-12 shrink-0 items-center px-4 md:sr-only">
          Settings
        </DialogTitle>
        <DialogDescription className="sr-only">
          Change how the app looks and behaves.
        </DialogDescription>

        <div className="flex h-[28rem] max-h-[75svh] min-h-0 flex-col overflow-hidden rounded-b-xl md:h-[30rem] md:flex-row md:rounded-xl">
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

          {/*
            `min-w-0`, and it is the whole of why the right edge was being cut
            off rather than merely tight.

            A flex item's automatic minimum size is the intrinsic width of its
            contents, so this column was refusing to be narrower than Clerk's
            widest row: instead of the row overflowing the column, the column
            overflowed the dialog, and the `overflow-hidden` on the wrapper
            above sliced off whatever hung past the edge — the action button on
            the end of the row, every time. Told it may be narrower than its
            contents, the column stops at the dialog's edge and anything still
            too wide overflows *inside* the scroller below, where it can be
            scrolled to instead of disappearing.

            The same rule, for the same reason, as the drive's and the todo
            board's — see `main-content.tsx`.
          */}
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
            {/*
              The same list on a narrow screen, across the top. `Tabs` here is
              the switch and nothing else — the panel below is rendered once for
              both layouts rather than duplicated into `TabsContent`, so there
              is only ever one of each setting on the page.
            */}
            <div className="p-2 md:hidden">
              <Tabs
                value={active.id}
                onValueChange={(value) => setSection(value as SettingsSection)}
              >
                <TabsList variant="settingsTab" className="w-full">
                  {SETTINGS_SECTIONS.map((entry) => (
                    <TabsTrigger key={entry.id} value={entry.id}>
                      <entry.icon />
                      {entry.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/*
              `overflow-x-auto` said out loud rather than left to the browser's
              own inference from `overflow-y`. It is the last line of defence:
              if a Clerk row is ever wider than this column again, it becomes
              something the reader can scroll to rather than something that is
              silently not there.
            */}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto px-5">
              {/*
                `pr-10` on the wide layout: the close button is pinned to the
                dialog's top right, which up here is over the heading rather
                than over the tab bar.
              */}
              <header className="py-3 md:pr-10">
                <h2 className="text-base font-semibold">{active.label}</h2>
                <p className="text-xs text-muted-foreground">
                  {active.description}
                </p>
              </header>

              {active.id === "general" && <GeneralSettings />}
              {active.id === "usage" && <UsagePanel />}
              {active.id === "account" && (
                <AccountSettings getContainer={() => portalRef.current} />
              )}
              {active.id === "security" && (
                <SecuritySettings getContainer={() => portalRef.current} />
              )}
            </div>
          </div>
        </div>

        <div ref={portalRef} />
      </DialogContent>
    </Dialog>
  );
}
