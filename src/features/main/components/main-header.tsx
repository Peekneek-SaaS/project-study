"use client";

import { UserButton } from "@clerk/nextjs";
import MainBreadCrumbs from "./main-breadcrumbs";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, UserRound } from "lucide-react";
import { useSearchStore } from "@/lib/stores/search-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Logo from "@/components/logo";
import {
  usePrefetchSearchItems,
  useWarmSearchItems,
} from "@/features/main/hooks/use-search-items";

const MainHeader = () => {
  const openSearch = useSearchStore((state) => state.open);

  // The palette is fetched before it is asked for: once on idle, and again on
  // the way to the button, so it opens with results rather than a spinner.
  useWarmSearchItems();
  const prefetchSearch = usePrefetchSearchItems();

  // The shorter height is gated behind `md:` because that is the only place it
  // can honestly apply: the icon-collapsed sidebar is desktop-only, and
  // `useIsMobile` reports false until its effect runs. Without the gate a phone
  // renders the collapsed header, then grows it a frame later once hydration
  // corrects the guess — with a transition on `height` to make sure it is seen.
  return (
    // `bg-background` rather than nothing: the header is sticky, so the page
    // scrolls *behind* it, and a transparent one shows the rows sliding through
    // the logo and the buttons. The inset it sits in paints the same colour, so
    // this only ever shows where something would otherwise pass underneath.
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 bg-background transition-[width,height] ease-linear md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 border-b">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        {/* <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
        /> */}
        <Logo className="md:hidden" href="/main" />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={openSearch}
          // Hover covers a mouse crossing the header; `pointerdown` is the only
          // warning a touch gives, and still lands before the click.
          onMouseEnter={prefetchSearch}
          onFocus={prefetchSearch}
          onPointerDown={prefetchSearch}
          aria-label="Search folders and files"
        >
          <Search />
        </Button>
        <ModeToggle />
        {/*
          A slot of a fixed size, rather than two things asked to agree on one.
          The classes handed to `appearance` land on the same elements Clerk's
          own stylesheet targets, at the same specificity — and that stylesheet
          is injected at runtime, after this app's, so it wins the tie and the
          button arrives bigger than the avatar standing in for it. Sizing the
          descendants from out here outranks both.
        */}
        <div className="flex size-8 shrink-0 items-center justify-center [&_.cl-avatarBox]:size-8 [&_.cl-userButtonBox]:size-8 [&_.cl-userButtonTrigger]:size-8 [&_.cl-userButtonTrigger]:p-0">
          <UserButton
            fallback={
              <Avatar className="size-8">
                <AvatarFallback>
                  <UserRound className="size-4" />
                </AvatarFallback>
              </Avatar>
            }
          />
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
