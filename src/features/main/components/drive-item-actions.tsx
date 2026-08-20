"use client";

import {
  FileSearch,
  FileText,
  FolderOpen,
  Link2,
  Lock,
  LockOpen,
  type LucideIcon,
  MoreVertical,
  Pen,
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
import { documentPreviewPath } from "@/lib/document-links";
import { useDriveStore } from "@/lib/stores/drive-store";
import { useModalStore } from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";

interface MenuItemConfig {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  /**
   * `DropdownMenuItem`'s own variants — anything else is not a style the menu
   * knows how to render.
   */
  variant?: "default" | "destructive" | "success";
  className?: string;
  disabled?: boolean;
}

type DriveItemActionsProps =
  | { kind: "document"; item: DriveDocument }
  | { kind: "folder"; item: DriveFolder };

/**
 * Copies the document's preview page, not its storage URL — the page is the
 * shareable thing, and it checks who is asking. Nobody can open it but the
 * owner yet, so this is a link you can hold onto rather than one you can hand out.
 */
const copyPreviewLink = async (documentId: string) => {
  try {
    await navigator.clipboard.writeText(
      new URL(documentPreviewPath(documentId), window.location.origin).href,
    );
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy the link");
  }
};

/**
 * A read-out of `isLocked`, not a switch: selecting it does nothing until
 * unlocking is actually wired up. Both states are rendered so the row reads the
 * same either way — locked in emerald, unlocked muted.
 */
function lockItem(isLocked: boolean): MenuItemConfig {
  return isLocked
    ? {
        icon: Lock,
        label: "Locked",
        onSelect: () => {},
        variant: "success",
      }
    : {
        icon: LockOpen,
        label: "Unlocked",
        onSelect: () => {},
        className: "text-muted-foreground *:[svg]:text-muted-foreground",
      };
}

function documentItems(
  doc: DriveDocument,
  confirmDelete: () => void,
  promptRename: () => void,
  openDocument: (doc: DriveDocument) => void,
  previewDocument: (doc: DriveDocument) => void,
): MenuItemConfig[] {
  // Nothing to open or glance at until the workspace has been built.
  const notReady = doc.status !== "READY";

  return [
    {
      icon: FileText,
      label: "Open",
      onSelect: () => openDocument(doc),
      disabled: notReady,
    },
    {
      icon: FileSearch,
      label: "Quick preview",
      onSelect: () => previewDocument(doc),
      disabled: notReady,
    },
    {
      icon: Pen,
      label: "Edit name",
      onSelect: promptRename,
    },
    lockItem(doc.isLocked),
    {
      icon: Link2,
      label: "Copy link",
      onSelect: () => void copyPreviewLink(doc.id),
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
  promptRename: () => void,
  openFolder: (folder: { id: string; name: string }) => void,
): MenuItemConfig[] {
  return [
    {
      icon: FolderOpen,
      label: "Open",
      onSelect: () => openFolder({ id: folder.id, name: folder.name }),
    },
    {
      icon: Pen,
      label: "Edit name",
      onSelect: promptRename,
    },
    lockItem(folder.isLocked),
    {
      icon: Trash2,
      label: "Delete",
      onSelect: confirmDelete,
      // As on a document. This was the one delete in the app that read as an
      // ordinary entry, which made deleting a folder — the more destructive of
      // the two, since it takes everything inside with it — the quieter one.
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
  const { open: openDocument, preview: previewDocument } = useOpenDocument();

  // Both dialogs live in `ModalProvider`, so they outlive this row being
  // re-rendered away by the refetch that follows the delete or the rename.
  const itemRef = {
    kind: props.kind,
    id: props.item.id,
    name: props.item.name,
  };
  const confirmDelete = () => openModal("delete-item", itemRef);
  const promptRename = () => openModal("rename-item", itemRef);

  const menuItems =
    props.kind === "document"
      ? documentItems(
          props.item,
          confirmDelete,
          promptRename,
          openDocument,
          previewDocument,
        )
      : folderItems(props.item, confirmDelete, promptRename, openFolder);

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
        <DropdownMenuGroup className="space-y-1">
          {menuItems.map(
            ({ label, onSelect, variant, className, disabled, icon: Icon }) => (
              <DropdownMenuItem
                key={label}
                variant={variant}
                className={cn("", className)}
                disabled={disabled}
                onSelect={onSelect}
              >
                <Icon className="" />
                <span>{label}</span>
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
