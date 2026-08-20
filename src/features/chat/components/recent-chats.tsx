"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { MotionTableBody } from "@/components/motion/motion-table";
import { Button } from "@/components/ui/button";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChatRow } from "@/features/chat/components/chat-row";
import { DeleteChatsDialog } from "@/features/chat/components/delete-chats-dialog";
import { RenameChatDialog } from "@/features/chat/components/rename-chat-dialog";
import { chatPath, type ChatSummary } from "@/features/chat/types";
import { ROW_ATTRIBUTE } from "@/hooks/use-row-interaction";
import { useRowSelection } from "@/hooks/use-row-selection";
import { listContainer, mountAnimation } from "@/lib/motion";
import { useChatSelectionStore } from "@/lib/stores/chat-selection-store";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Past conversations, parked under the fold.
 *
 * The heading sits just inside the viewport with the rows below it — enough to
 * say "your history is down here" without competing with the thing the page is
 * for, which is asking a new question.
 *
 * Everything about handling the rows is the drive's, deliberately: click to
 * select, double-click to open, Cmd/ctrl and shift to build a selection, a hold
 * to start one on a phone, arrows and Enter from the keyboard, and a toolbar
 * that cross-fades in to delete the lot. Almost none of that is implemented
 * here — it is the same three hooks the drive and the boards use, which is the
 * only way three lists stay identical to use rather than merely similar.
 */

/** Keeps the column headings under the peek line as the rows scroll past. */
const STICKY_HEAD =
  "md:sticky md:top-(--chat-sticky-top) md:z-10 md:bg-background md:shadow-[inset_0_-1px_0_0_var(--border)]";

export function RecentChats() {
  const trpc = useTRPC();
  const router = useRouter();
  const { data: chats } = useSuspenseQuery(trpc.chat.list.queryOptions());

  const selectedIds = useChatSelectionStore((state) => state.ids);
  const clearSelection = useChatSelectionStore((state) => state.clear);

  const [deletingMany, setDeletingMany] = useState<string[] | null>(null);
  // The dialogs live here rather than in each row: a row unmounts the moment
  // the list refetches after a rename, and it would take its dialog with it.
  const [renaming, setRenaming] = useState<ChatSummary | null>(null);

  /**
   * Conversations warmed on hover rather than on mount.
   *
   * Prefetching thirty because a list of them was rendered would fetch a great
   * deal nobody reads; the pointer arriving over a row is the earliest honest
   * signal of intent, and it buys the whole gap before the click.
   *
   * A ref rather than state — this is a "have I done this yet" ledger, and
   * putting it in state would re-render the whole table on every hover to
   * record something nothing renders.
   */
  const warmed = useRef(new Set<string>());
  const warm = useCallback(
    (chatId: string) => {
      if (warmed.current.has(chatId)) return;
      warmed.current.add(chatId);
      router.prefetch(chatPath(chatId));
    },
    [router],
  );

  const rows = useMemo(
    () =>
      chats.map((chat) => ({
        id: chat.id,
        open: () => router.push(chatPath(chat.id)),
      })),
    [chats, router],
  );
  const { selectRow, selectAll } = useRowSelection(rows, useChatSelectionStore);

  // What is on screen decides. Rows can go out from under a selection — deleted
  // from their own menu, or gone after a refetch — and reading the ticks back
  // off the list keeps a stale id out of the count and off the request.
  const selected = chats
    .filter((chat) => selectedIds.has(chat.id))
    .map((chat) => chat.id);

  const isSelecting = selected.length > 0;
  const allSelected = chats.length > 0 && selected.length === chats.length;

  // The selection bar stays mounted through its own fade-out, so it needs
  // something to say on the way out — reading the live count there would flash
  // "0 chats selected" across the fade. It holds the last count it was shown
  // with, updated during the render that changes it rather than in an effect,
  // which would paint the old number for a frame first.
  const [shownCount, setShownCount] = useState(selected.length);
  if (isSelecting && shownCount !== selected.length)
    setShownCount(selected.length);

  if (chats.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-10">
        <p className="border-t py-6 text-center text-sm text-muted-foreground">
          Your past chats will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      {/*
        The two bars share one grid cell and cross-fade in place, so the rows
        below never shift as a selection opens and closes.
      */}
      <div className="sticky top-(--chat-sticky-top) z-20 grid h-10 grid-cols-1 grid-rows-1 bg-background *:col-start-1 *:row-start-1">
        <div
          inert={isSelecting}
          className={cn(
            "flex items-center text-xs font-medium text-muted-foreground",
            "transition-[opacity,visibility] duration-150 ease-out",
            isSelecting && "invisible opacity-0",
          )}
        >
          Recent chats
        </div>

        <div
          inert={!isSelecting}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-md bg-input/30 px-2",
            "transition-[opacity,visibility] duration-150 ease-out",
            !isSelecting && "invisible opacity-0",
          )}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={clearSelection}
            >
              <X />
            </Button>
            {/* `tabular-nums` so counting up does not shuffle everything to the
                right of the number by a fraction of a character. */}
            <span className="text-xs tabular-nums">
              {shownCount} {shownCount === 1 ? "chat" : "chats"} selected
            </span>
            {/* Hidden rather than dropped once everything is picked, so the
                controls either side of it stay put. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              inert={allSelected}
              className={cn("h-7 text-xs", allSelected && "invisible")}
            >
              Select all
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDeletingMany(selected)}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <div
        // Hands the sticky heading back to the page. `Table` ships wrapped in
        // `overflow-x-auto`, and a `sticky` element inside a scroll container
        // sticks to *that* container rather than to the page — so above the
        // breakpoint the container is told not to scroll, and the heading works.
        className="md:[&_[data-slot=table-container]]:overflow-x-visible"
        // Clicking past the rows drops the selection, the way clicking empty
        // space in a file manager does. Rows answer their own clicks; buttons
        // and menus speak for themselves. Anything else here is background.
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(`[${ROW_ATTRIBUTE}], button, a, [role='menuitem']`))
            return;
          clearSelection();
        }}
      >
        <Table>
          {/*
            Present for screen readers and gone for everyone else. The visible
            heading is the sticky bar above, which doubles as the selection
            toolbar — but a table still owes its rows column names, and three
            unlabelled columns are three a screen reader cannot describe.
          */}
          <TableHeader className="">
            <TableRow>
              <TableHead className={STICKY_HEAD}>Chat</TableHead>
              {/* <TableHead className={cn(STICKY_HEAD, "hidden sm:table-cell")}>
                Model
              </TableHead> */}
              {/*
                Dropped on a phone, where the row has room for the title and
                nothing else: a name truncated to make space for "3 days ago" is
                the wrong half to keep. The cell goes with it — see `ChatRow`.
              */}
              <TableHead className={cn(STICKY_HEAD, "hidden sm:table-cell")}>
                Last active
              </TableHead>
              <TableHead className={cn(STICKY_HEAD, "w-12 text-right")}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          {/* The stagger lives on the body, so the rows deal in one after
              another rather than all arriving at once. */}
          <MotionTableBody {...mountAnimation} variants={listContainer}>
            {chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                onSelect={selectRow}
                onRename={setRenaming}
                // One row's menu and a whole selection go to the same dialog:
                // the copy is a count either way, so there is nothing a
                // single-chat version would say differently.
                onDelete={(target: ChatSummary) => setDeletingMany([target.id])}
                onWarm={warm}
              />
            ))}
          </MotionTableBody>
        </Table>
      </div>

      <RenameChatDialog chat={renaming} onClose={() => setRenaming(null)} />

      <DeleteChatsDialog
        ids={deletingMany}
        onClose={() => setDeletingMany(null)}
      />
    </div>
  );
}

/** The list's shape while it loads, so the peek does not jump into place. */
export function RecentChatsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 pb-16")}>
      <div className="flex h-10 items-center">
        <span className="text-xs font-medium text-muted-foreground">
          Recent chats
        </span>
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 border-b py-3.5">
          <div className="size-3.5 shrink-0 animate-pulse rounded bg-muted" />
          <div
            className="h-3.5 animate-pulse rounded bg-muted"
            // Varied widths so it reads as a list of titles rather than a
            // loading bar drawn five times.
            style={{ width: `${45 + ((index * 13) % 30)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
