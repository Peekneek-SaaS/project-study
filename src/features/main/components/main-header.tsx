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

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 border-b">
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
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8",
              userButtonBox: "size-8",
              userButtonTrigger: "size-8",
            },
          }}
          fallback={
            <Avatar className="size-8">
              <AvatarFallback>
                <UserRound className="size-4" />
              </AvatarFallback>
            </Avatar>
          }
        />
      </div>
    </header>
  );
};

export default MainHeader;
