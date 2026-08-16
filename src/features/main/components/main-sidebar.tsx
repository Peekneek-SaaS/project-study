"use client";

import {
  AudioLines,
  Headphones,
  Home,
  LayoutGrid,
  type LucideIcon,
  NotebookPen,
  PlusIcon,
  Settings,
  Shapes,
  SquareMousePointer,
  StickyNote,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateDropdown from "./create-dropdown";
import Image from "next/image";
import Logo from "@/components/logo";

export interface MenuItemsProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  iconClassName?: string;
}

interface MenuGroupProps {
  groupLabel?: string;
  items: MenuItemsProps[];
  pathName: string;
}

const MainSidebar = () => {
  const pathName = usePathname();

  const routes: MenuItemsProps[] = [
    {
      label: "Dashboard",
      href: "/main",
      icon: Home,
      iconClassName: "fill-blue-500 stroke-blue-400",
    },
    {
      label: "Board",
      href: "/board",
      icon: Shapes,
      iconClassName: "fill-purple-500 stroke-purple-500",
    },
    {
      label: "Sticky Notes",
      href: "/sticky-notes",
      icon: StickyNote,
      iconClassName: "fill-yellow-400 stroke-yellow-200",
    },
  ];

  const otherRoutes: MenuItemsProps[] = [
    {
      label: "Settings",
      icon: Settings,
    },
    {
      label: "Help and support",
      href: "mailto:business@codewithantonio.com",
      icon: Headphones,
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
          <Logo href="/main" />
          <SidebarTrigger className="ml-auto md:hidden" />
        </div>
        <CreateDropdown
          buttonLabel="New"
          buttonIcon={<PlusIcon />}
          buttonIconPosition="start"
        />
      </SidebarHeader>
      {/* <div className="border-b border-dashed border-border" /> */}
      <SidebarContent>
        <NavItems items={routes} pathName={pathName} />
        <NavItems groupLabel="Others" items={otherRoutes} pathName={pathName} />
      </SidebarContent>
    </Sidebar>
  );
};

export default MainSidebar;

const NavItems = ({ groupLabel, items, pathName }: MenuGroupProps) => {
  const { setOpenMobile } = useSidebar();

  /**
   * On mobile the sidebar *is* a sheet, and a sheet does not know that a link
   * inside it went anywhere — the route changes underneath while the sheet
   * stays put, covering the page it just opened. Closing it is this component's
   * job, since nothing about the navigation does it.
   *
   * Harmless on desktop: `openMobile` drives the sheet, and the sheet is not
   * rendered there.
   */
  const handleSelect = (item: MenuItemsProps) => {
    setOpenMobile(false);
    item.onClick?.();
  };

  return (
    <SidebarGroup className="space-y-2">
      {groupLabel && (
        <SidebarGroupLabel className="text-muted-foreground text-[11px] uppercase group-data-[collapsible=icon]:hidden">
          {groupLabel}
        </SidebarGroupLabel>
      )}

      {items.map((item, index) => (
        <SidebarMenu key={index}>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild={!!item.href}
              isActive={
                item.href
                  ? item.href === "/"
                    ? pathName === "/"
                    : pathName.startsWith(item.href)
                  : false
              }
              onClick={() => handleSelect(item)}
              tooltip={item.label}
              className={cn(
                "h-9 px-3 py-2 text-[13px] tracking-tight font-medium border border-transparent bg-transparent data-[active=true]:border-primary data-[active=true]:bg-transparent",
              )}
            >
              {item.href ? (
                <Link href={item.href}>
                  <item.icon className={cn("", item.iconClassName)} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <>
                  <item.icon className={cn("", item.iconClassName)} />
                  <span>{item.label}</span>
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      ))}
    </SidebarGroup>
  );
};
