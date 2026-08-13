"use client";

import { UserButton } from "@clerk/nextjs";
import MainBreadCrumbs from "./main-breadcrumbs";

const MainHeader = () => {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4">
      <MainBreadCrumbs />
      <UserButton appearance={{}} />
    </header>
  );
};

export default MainHeader;
