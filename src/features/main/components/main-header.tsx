"use client";

import { UserButton } from "@clerk/nextjs";
import MainBreadCrumbs from "./main-breadcrumbs";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useSearchStore } from "@/lib/stores/search-store";

const MainHeader = () => {
  const openSearch = useSearchStore((state) => state.open);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 border-b">
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
        <UserButton appearance={{}} />
      </div>
    </header>
  );
};

export default MainHeader;
