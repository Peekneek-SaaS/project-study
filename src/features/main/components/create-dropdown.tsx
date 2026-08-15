"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderPlus, SquareMousePointer, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useCreateBoard } from "@/features/board/hooks/use-create-board";
import { MenuItemsProps } from "./main-sidebar";
import { useModalStore } from "@/lib/stores/modal-store";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface CreateDropdownProps {
  buttonLabel: string;
  // A rendered element, not a component: server components may render this and
  // can only pass plain serializable props across the boundary.
  buttonIcon?: ReactNode;
  buttonIconPosition?: "start" | "end";
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
}
const SHEET_EXIT_MS = 200;

const CreateDropdown = ({
  buttonLabel,
  buttonIcon,
  buttonIconPosition = "start",
  buttonVariant = "default",
  className,
}: CreateDropdownProps) => {
  const openModal = useModalStore((state) => state.open);
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const { createBoard } = useCreateBoard();

  // Opening a modal from inside the mobile sheet has to wait for the sheet to
  // animate out, or the two overlays fight. Rendered outside the sheet (the
  // page header), there is nothing to close and nothing to wait for.
  const runFromSidebar = (action: () => void) => {
    if (!isMobile || !openMobile) {
      action();
      return;
    }
    setOpenMobile(false);
    window.setTimeout(action, SHEET_EXIT_MS);
  };

  const createActions: MenuItemsProps[] = [
    {
      label: "New Folder",
      icon: FolderPlus,
      onClick: () => runFromSidebar(() => openModal("create-folder")),
    },
    {
      label: "New Board",
      icon: SquareMousePointer,
      // Not `runFromSidebar`: this navigates rather than opening an overlay, so
      // there is nothing for the sheet to fight with and no reason to hold the
      // request back until it has finished animating. It does still have to
      // close, or it would sit on top of the board it just opened.
      onClick: () => {
        setOpenMobile(false);
        void createBoard();
      },
    },
  ];

  const uploadActions: MenuItemsProps[] = [
    {
      label: "Upload File",
      icon: Upload,
      onClick: () => runFromSidebar(() => openModal("upload-file")),
    },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={buttonVariant} className={cn("py-4!", className)}>
          {buttonIconPosition === "start" && buttonIcon}
          <span className="group-data-[collapsible=icon]:hidden">
            {buttonLabel}
          </span>
          {buttonIconPosition === "end" && buttonIcon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          {createActions.map(({ label, icon: Icon2, onClick, href }) => (
            <DropdownMenuItem onClick={onClick} key={label}>
              <Icon2 />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
          <Separator className="my-1" />
          {uploadActions.map(({ label, icon: Icon2, onClick, href }) => (
            <DropdownMenuItem onClick={onClick} key={label}>
              <Icon2 />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CreateDropdown;
