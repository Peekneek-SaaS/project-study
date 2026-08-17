"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChatSummary } from "@/features/chat/types";
import { useTRPC } from "@/trpc/client";

/**
 * Renames a conversation.
 *
 * Titles are written for you — the first question becomes the name, because
 * asking for one before anything has been said puts a dialog in front of the
 * thing the user came to do. That is right for almost every chat and wrong for
 * the few worth keeping, where "what is the difference between mitosis and
 * meiosis" is a worse label than "Cell division revision". This is the escape
 * hatch for those.
 *
 * Renaming is also what makes the automatic title safe: `resolveChat` only ever
 * names a chat still called "New chat", so a name typed here is never
 * overwritten by a later turn.
 *
 * Held by the table rather than by the row, like the boards' — a row unmounts
 * the moment the list refetches and would take its dialog with it.
 */
export function RenameChatDialog({
  chat,
  onClose,
}: {
  /** The conversation being renamed, or `null` when the dialog is not up. */
  chat: ChatSummary | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const rename = useMutation(trpc.chat.rename.mutationOptions());

  // Held past closing so the field keeps its text while the dialog animates
  // out, rather than emptying mid-transition.
  const [lastChat, setLastChat] = useState(chat);
  const [title, setTitle] = useState(chat?.title ?? "");
  const [wasOpen, setWasOpen] = useState(chat !== null);

  // Seed from the row each time the dialog opens, and again if a different row
  // is handed over while it is up — so reopening the same chat starts from the
  // stored title, not from whatever was typed and abandoned last time.
  const isOpening = chat !== null && !wasOpen;
  if (chat && (isOpening || chat !== lastChat)) {
    setLastChat(chat);
    setTitle(chat.title);
  }
  if ((chat !== null) !== wasOpen) setWasOpen(chat !== null);

  const item = chat ?? lastChat;

  /** The content unmounts while closed, so mounting the input *is* opening. */
  const focusAndSelect = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const trimmed = title.trim();
  const canSubmit = !!trimmed && trimmed !== item?.title && !rename.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chat || !canSubmit) return;

    try {
      const saved = await rename.mutateAsync({ id: chat.id, title: trimmed });
      // The whole router: the conversation page reads its own title through
      // `chat.get`, and it is the same chat that just changed.
      await queryClient.invalidateQueries(trpc.chat.pathFilter());
      toast.success(`Renamed to ${saved.title}`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not rename this chat",
      );
    }
  };

  return (
    <Modal
      title="Rename chat"
      description="Only the name changes — everything said in the conversation stays as it is."
      open={chat !== null}
      onOpenChange={(open) => {
        if (!open && !rename.isPending) onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="chat-title">Chat name</Label>
          <Input
            id="chat-title"
            ref={focusAndSelect}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={rename.isPending}
            // Matches the router's own ceiling, so a name too long to store is
            // refused by the field rather than by an error after submitting.
            maxLength={200}
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
