"use client";

import {
  AudioLines,
  CircleDashed,
  Focus,
  Headphones,
  Home,
  LayoutGrid,
  type LucideIcon,
  MessageSquare,
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
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSettingsStore } from "@/lib/stores/settings-store";
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
  const openSettings = useSettingsStore((state) => state.open);

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
      label: "Sticky Note",
      href: "/sticky-notes",
      icon: StickyNote,
      iconClassName: "fill-yellow-400 stroke-yellow-200",
    },

    {
      label: "Todo",
      href: "/todo",
      icon: CircleDashed,
      iconClassName: "stroke-red-500 [stroke-width:2.5]",
    },
    {
      label: "Chat",
      href: "/chat",
      icon: MessageSquare,
      iconClassName: "fill-emerald-500 stroke-emerald-500",
    },
    // {
    //   label: "Focus",
    //   href: "/focus",
    //   icon: Focus,
    //   iconClassName: "stroke-cyan-500 fill-cyan-500",
    // },
  ];

  const otherRoutes: MenuItemsProps[] = [
    {
      label: "Settings",
      icon: Settings,
      // No `href`: settings are a dialog rather than a page, so this row opens
      // one instead of navigating. `NavItems` calls `onClick` for exactly this.
      onClick: () => openSettings(),
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
      </SidebarContent>

      {/*
        No horizontal padding of its own: `NavItems` renders a `SidebarGroup`,
        which brings `px-2` with it, and `SidebarContent` above adds none — so
        the footer's `p-2` would inset these rows 8px further than every row
        above them, and park the collapsed icons off-centre in the rail.
      */}
      <SidebarFooter className="px-0">
        <NavItems groupLabel="Others" items={otherRoutes} pathName={pathName} />
      </SidebarFooter>
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
