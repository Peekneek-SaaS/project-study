"use client";

import { UserButton } from "@clerk/nextjs";
import MainBreadCrumbs from "./main-breadcrumbs";
import { ModeToggle } from "@/components/mode-toggle";

const MainHeader = () => {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4">
      <MainBreadCrumbs />
      <div className="flex items-center gap-2">
        <ModeToggle />
        <UserButton appearance={{}} />
      </div>
    </header>
  );
};

export default MainHeader;
