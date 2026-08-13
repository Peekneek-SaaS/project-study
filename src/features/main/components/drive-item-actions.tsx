"use client";

import {
  FileSearch,
  FolderOpen,
  Link2,
  type LucideIcon,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOpenDocument } from "@/features/main/hooks/use-open-document";
import type { DriveDocument, DriveFolder } from "@/features/main/types";
import { useDriveStore } from "@/lib/stores/drive-store";
import { useModalStore } from "@/lib/stores/modal-store";

interface MenuItemConfig {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  /**
   * `DropdownMenuItem`'s own variants — anything else is not a style the menu
   * knows how to render.
   */
  variant?: "default" | "destructive";
  disabled?: boolean;
}

type DriveItemActionsProps =
  | { kind: "document"; item: DriveDocument }
  | { kind: "folder"; item: DriveFolder };

const copyLink = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy the link");
  }
};

function documentItems(
  doc: DriveDocument,
  confirmDelete: () => void,
  openDocument: (doc: DriveDocument) => void,
): MenuItemConfig[] {
  return [
    {
      icon: FileSearch,
      label: "Open",
      onSelect: () => openDocument(doc),
      // Nothing to open until the upload has landed.
      disabled: doc.status !== "READY",
    },
    {
      icon: Link2,
      label: "Copy link",
      onSelect: () => void copyLink(doc.pdfUrl),
      disabled: doc.status !== "READY",
    },
    {
      icon: Trash2,
      label: "Delete",
      onSelect: confirmDelete,
      variant: "destructive",
    },
  ];
}

function folderItems(
  folder: DriveFolder,
  confirmDelete: () => void,
  openFolder: (folder: { id: string; name: string }) => void,
): MenuItemConfig[] {
  return [
    {
      icon: FolderOpen,
      label: "Open",
      onSelect: () => openFolder({ id: folder.id, name: folder.name }),
    },
    {
      icon: Trash2,
      label: "Delete",
      onSelect: confirmDelete,
      variant: "destructive",
    },
  ];
}

/**
 * Row menu for a document or a folder.
 *
 * One component for both: the trigger and the plumbing are identical and only
 * the entries differ, so the two are built per kind and rendered the same way.
 */
export function DriveItemActions(props: DriveItemActionsProps) {
  const openModal = useModalStore((state) => state.open);
  const openFolder = useDriveStore((state) => state.openFolder);
  const openDocument = useOpenDocument();

  // The confirmation lives in `ModalProvider`, so it outlives this row being
  // re-rendered away by the refetch that follows the delete.
  const confirmDelete = () =>
    openModal("delete-item", {
      kind: props.kind,
      id: props.item.id,
      name: props.item.name,
    });

  const menuItems =
    props.kind === "document"
      ? documentItems(props.item, confirmDelete, openDocument)
      : folderItems(props.item, confirmDelete, openFolder);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Options for ${props.item.name}`}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40" align="end">
        <DropdownMenuGroup>
          {menuItems.map(({ label, onSelect, variant, disabled, icon: Icon }) => (
            <DropdownMenuItem
              key={label}
              variant={variant}
              disabled={disabled}
              onSelect={onSelect}
            >
              <Icon />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
