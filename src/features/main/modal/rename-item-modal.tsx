"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { keepExtension } from "@/lib/document-file-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDriveNavigation } from "@/features/main/hooks/use-drive-navigation";
import { selectRenameTarget, useModalStore } from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";

const COPY = {
  document: {
    title: "Rename file",
    description:
      "Only the name in your drive changes — the file itself and any link to it stay as they are.",
    label: "File name",
  },
  folder: {
    title: "Rename folder",
    description: "Everything inside the folder stays where it is.",
    label: "Folder name",
  },
} as const;

/**
 * How much of the name to preselect: everything for a folder, everything but
 * the extension for a file, so typing over it does not silently drop the
 * `.pdf` the name is expected to carry. A leading dot is a hidden file, not an
 * extension, hence the `> 0`.
 */
function editableLength(kind: "document" | "folder", name: string) {
  if (kind === "folder") return name.length;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? dot : name.length;
}

/**
 * Renames a document or a folder.
 *
 * One modal for both, as with `DeleteModal`: the target arrives on the
 * `open("rename-item", …)` payload, so the row that asked for it can unmount
 * (which it does — the refetch after a rename rebuilds the table) without
 * taking the dialog with it.
 */
export function RenameItemModal() {
  const target = useModalStore(selectRenameTarget);
  const closeModal = useModalStore((state) => state.close);
  const { renameCrumb } = useDriveNavigation();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const renameDocument = useMutation(trpc.document.rename.mutationOptions());
  const renameFolder = useMutation(trpc.folder.rename.mutationOptions());
  const isPending = renameDocument.isPending || renameFolder.isPending;

  // Closing clears the payload, so hold the last one: it keeps the copy in
  // place while the dialog animates out instead of blanking mid-transition.
  const [lastTarget, setLastTarget] = useState(target);
  const [name, setName] = useState(target?.name ?? "");
  const [wasOpen, setWasOpen] = useState(target !== null);

  // Seed the field from the row every time the dialog opens, and again if a
  // different row is handed to it while it is up. Keyed on opening rather than
  // on the payload's identity, so reopening the same row still starts from the
  // stored name instead of whatever was typed and abandoned last time.
  const isOpening = target !== null && !wasOpen;
  if (target && (isOpening || target !== lastTarget)) {
    setLastTarget(target);
    setName(target.name);
  }
  if ((target !== null) !== wasOpen) setWasOpen(target !== null);

  const item = target ?? lastTarget;
  const kind = item?.kind;

  /**
   * The dialog's content is unmounted while it is closed, so mounting the input
   * *is* opening: focus it and preselect the part that is meant to be typed
   * over. Stable across renders, or React would re-run it on every keystroke
   * and drag the caret back.
   */
  const focusAndSelect = useCallback(
    (input: HTMLInputElement | null) => {
      if (!input || !kind) return;
      input.focus();
      input.setSelectionRange(0, editableLength(kind, input.value));
    },
    [kind],
  );

  const handleOpenChange = (open: boolean) => {
    if (open || isPending) return;
    closeModal();
  };

  const trimmed = name.trim();
  // What the server will actually store: a file keeps its extension whether or
  // not the new name carries one, so say so before the dialog closes rather
  // than surprising the user with a name they did not type.
  const finalName =
    item && item.kind === "document" ? keepExtension(item.name, trimmed) : trimmed;
  const isUnchanged = !!item && finalName === item.name;
  const canSubmit = !!trimmed && !isUnchanged && !isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || !canSubmit) return;
    const { kind, id, name: previousName } = target;

    try {
      // The server has the last word on the name — it is the one that keeps a
      // file's extension attached — so report what came back, not what was typed.
      let savedName = trimmed;

      if (kind === "document") {
        savedName = (await renameDocument.mutateAsync({ id, name: trimmed }))
          .name;
      } else {
        await renameFolder.mutateAsync({ id, name: trimmed });
        // No-op unless the folder is on the trail, which beats a breadcrumb
        // still showing the name the folder had a moment ago.
        renameCrumb(id, trimmed);
      }

      toast.success(`Renamed ${previousName} to ${savedName}`);
      closeModal();
      // The listing, the breadcrumb query and the search palette all carry the
      // old name; the preview page carries it too for a document.
      await Promise.all([
        queryClient.invalidateQueries(trpc.folder.pathFilter()),
        kind === "document"
          ? queryClient.invalidateQueries(trpc.document.pathFilter())
          : undefined,
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not rename ${previousName}`,
      );
    }
  };

  if (!item) return null;

  const copy = COPY[item.kind];

  return (
    <Modal
      open={target !== null}
      onOpenChange={handleOpenChange}
      title={copy.title}
      description={copy.description}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-name">{copy.label}</Label>
          <Input
            id="item-name"
            ref={focusAndSelect}
            value={name}
            maxLength={255}
            disabled={isPending}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          {finalName !== trimmed && (
            <p className="text-xs text-muted-foreground">
              Saved as <span className="font-medium">{finalName}</span> — the
              extension stays with the file.
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
