"use client";

import {
  AudioLines,
  FolderPlus,
  Headphones,
  Home,
  LayoutGrid,
  type LucideIcon,
  PlusIcon,
  Settings,
  Upload,
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
import { useModalStore } from "@/lib/stores/modal-store";

/** Matches `SheetContent`'s `duration-200` exit transition. */
const SHEET_EXIT_MS = 200;

interface MenuItemsProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
}

interface MenuGroupProps {
  groupLabel?: string;
  items: MenuItemsProps[];
  pathName: string;
}

const MainSidebar = () => {
  const pathName = usePathname();
  const openModal = useModalStore((state) => state.open);
  const { isMobile, setOpenMobile } = useSidebar();

  /**
   * On mobile the sidebar *is* a sheet — its own dialog. Opening a modal from
   * inside it would stack two overlays and leave focus behind with the sheet,
   * so close the sheet first and let it finish animating out before handing the
   * screen over.
   */
  const runFromSidebar = (action: () => void) => {
    if (!isMobile) {
      action();
      return;
    }
    setOpenMobile(false);
    window.setTimeout(action, SHEET_EXIT_MS);
  };

  const routes: MenuItemsProps[] = [
    {
      label: "Dashboard",
      href: "/main",
      icon: Home,
    },
    {
      label: "Explore Board",
      href: "/board",
      icon: LayoutGrid,
    },
    {
      label: "Text to speech",
      href: "/text-to-speech",
      icon: AudioLines,
    },
    {
      label: "Voice cloning",
      icon: Volume2,
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

  const createButtonActions: MenuItemsProps[] = [
    {
      label: "New Folder",
      icon: FolderPlus,
      onClick: () => runFromSidebar(() => openModal("create-folder")),
    },
    {
      label: "Upload File",
      icon: Upload,
      onClick: () => runFromSidebar(() => openModal("upload-file")),
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
          {/* <Image
            src="/logo.svg"
            alt="Resonance"
            width={24}
            height={24}
            className="rounded-sm"
          /> */}
          <span className="group-data-[collapsible=icon]:hidden font-semibold text-lg tracking-tighter text-foreground">
            Study
          </span>
          <SidebarTrigger className="ml-auto lg:hidden" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton variant="primary">
                  <PlusIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Create
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              {createButtonActions.map(
                ({ label, icon: Icon, onClick, href }) => (
                  <DropdownMenuItem onClick={onClick} key={label}>
                    <Icon />
                    <span>{label}</span>
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
  return (
    <SidebarGroup>
      {groupLabel && (
        <SidebarGroupLabel className="teext-muted-foreground text-[11px] uppercase">
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
              onClick={item.onClick}
              tooltip={item.label}
              className="h-9 px-3 py-2 text-[13px] tracking-tight font-medium border border-transparent data-[active=true]:border-border data-[active=true]:shadow-[0px_1px_1px_0px_rgba(44,54,53,0.03),inset_0px_0px_0px_2px_white]"
            >
              {item.href ? (
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <>
                  <item.icon />
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
