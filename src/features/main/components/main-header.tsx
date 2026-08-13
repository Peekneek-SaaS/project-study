"use client";

import { UserButton } from "@clerk/nextjs";
import MainBreadCrumbs from "./main-breadcrumbs";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, UserRound } from "lucide-react";
import { useSearchStore } from "@/lib/stores/search-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const MainHeader = () => {
  const openSearch = useSearchStore((state) => state.open);

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 border-b">
      <SidebarTrigger className="-ml-1" />
      {/* <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
      /> */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={openSearch}
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
