"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BoardListItem } from "@/features/board/types";
import { useTRPC } from "@/trpc/client";

/**
 * Renames a board.
 *
 * The target is passed in rather than read from `useModalStore`: that store
 * describes drive rows, and a board is not one. The table above holds this
 * dialog for the same reason the drive's modals live at the root — the row that
 * asked for it goes away when the list refetches.
 */
export function RenameBoardDialog({
  board,
  onClose,
}: {
  board: BoardListItem | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const rename = useMutation(trpc.board.rename.mutationOptions());

  // Held past closing so the field keeps its text while the dialog animates
  // out, rather than emptying mid-transition.
  const [lastBoard, setLastBoard] = useState(board);
  const [name, setName] = useState(board?.name ?? "");
  const [wasOpen, setWasOpen] = useState(board !== null);

  // Seed from the row each time the dialog opens, and again if a different row
  // is handed over while it is up — so reopening the same board starts from the
  // stored name, not from whatever was typed and abandoned last time.
  const isOpening = board !== null && !wasOpen;
  if (board && (isOpening || board !== lastBoard)) {
    setLastBoard(board);
    setName(board.name);
  }
  if ((board !== null) !== wasOpen) setWasOpen(board !== null);

  const item = board ?? lastBoard;

  /** The content unmounts while closed, so mounting the input *is* opening. */
  const focusAndSelect = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const trimmed = name.trim();
  const canSubmit = !!trimmed && trimmed !== item?.name && !rename.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!board || !canSubmit) return;

    try {
      const saved = await rename.mutateAsync({ id: board.id, name: trimmed });
      // The whole router: the canvas holds its own copy of the name through
      // `board.get`, and it is the same board that just changed.
      await queryClient.invalidateQueries(trpc.board.pathFilter());
      toast.success(`Renamed to ${saved.name}`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not rename the board",
      );
    }
  };

  return (
    <Modal
      title="Rename board"
      description="Only the name changes — the drawing is untouched."
      open={board !== null}
      onOpenChange={(open) => {
        if (!open && !rename.isPending) onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="board-name">Board name</Label>
          <Input
            id="board-name"
            ref={focusAndSelect}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={rename.isPending}
            maxLength={255}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={rename.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {rename.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
