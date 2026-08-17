"use client";

import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  MoreVertical,
  Pen,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MotionTableRow } from "@/components/motion/motion-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell } from "@/components/ui/table";
import { ProviderLogo } from "@/features/chat/components/provider-logo";
import { chatPath, type ChatSummary } from "@/features/chat/types";
import { DriveRowActions } from "@/features/main/components/drive-row-actions";
import { SELECTED_ROW_CLASS } from "@/features/main/lib/drive-row-classes";
import {
  type RowSelectModifiers,
  useRowInteraction,
} from "@/hooks/use-row-interaction";
import { PROVIDER_INFO, isAiProvider } from "@/lib/ai/types";
import { useChatSelectionStore } from "@/lib/stores/chat-selection-store";
import {
  selectHasSelection,
  selectIsRowSelected,
} from "@/lib/stores/create-selection-store";
import { listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One conversation in the recents list.
 *
 * Behaves like a row in the drive and in the boards table, because it is one:
 * click selects, double-click opens, ⌘/ctrl adds, shift takes a range, and on a
 * phone a tap opens while a hold starts a selection. All of that comes from
 * `useRowInteraction`, so the three lists cannot drift apart on the gesture
 * every one of them is judged by.
 *
 * Which cost the row its `<Link>`, the same way it cost the boards theirs: a
 * link that navigates on the first click cannot also be the first click of a
 * selection. "Open in new tab" moves into the menu, where it is still a real
 * anchor and still ⌘-clickable.
 */
export function ChatRow({
  chat,
  onSelect,
  onRename,
  onDelete,
  onWarm,
}: {
  chat: ChatSummary;
  onSelect: (modifiers: RowSelectModifiers, id: string) => void;
  onRename: (chat: ChatSummary) => void;
  onDelete: (chat: ChatSummary) => void;
  /** Prefetches the conversation on hover — see `RecentChats`. */
  onWarm: (id: string) => void;
}) {
  const router = useRouter();

  const isSelected = useChatSelectionStore(selectIsRowSelected(chat.id));
  const hasSelection = useChatSelectionStore(selectHasSelection);
  const toggle = useChatSelectionStore((state) => state.toggle);

  const rowProps = useRowInteraction({
    rowKey: chat.id,
    hasSelection,
    onToggle: () => toggle(chat.id),
    onOpen: () => router.push(chatPath(chat.id)),
    onSelect: (modifiers) => onSelect(modifiers, chat.id),
  });

  return (
    <MotionTableRow
      variants={listItem}
      {...rowProps}
      onMouseEnter={() => onWarm(chat.id)}
      onFocus={() => onWarm(chat.id)}
      aria-selected={isSelected}
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        // `select-none` so double-clicking to open does not leave the title
        // highlighted underneath the conversation.
        "cursor-default select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-input/50",
        SELECTED_ROW_CLASS,
      )}
    >
      <TableCell className="max-w-0">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare className="size-3.5 shrink-0 fill-emerald-500 stroke-emerald-500" />
          <span className="truncate">{chat.title}</span>
          {/* <span className="shrink-0 text-xs font-normal text-muted-foreground">
            {chat.messageCount}
          </span> */}
        </div>
      </TableCell>

      {/* <TableCell className="hidden text-muted-foreground sm:table-cell">
        {isAiProvider(chat.provider) ? (
          <span className="flex items-center gap-1.5">
            <ProviderLogo provider={chat.provider} labelled={false} />
            {PROVIDER_INFO[chat.provider].label}
          </span>
        ) : (
          "—"
        )}
      </TableCell> */}

      <TableCell className="whitespace-nowrap text-muted-foreground">
        {/* Wrapped because this arrives as an ISO string, not a `Date` — there
            is no transformer on the tRPC client. */}
        {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
      </TableCell>

      <DriveRowActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${chat.title}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            {/* A real anchor, so this is the one place a conversation can still
                be opened in a new tab or copied as a link. */}
            <DropdownMenuItem asChild>
              <Link href={chatPath(chat.id)}>
                <SquareArrowOutUpRight />
                Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRename(chat)}>
              <Pen />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(chat)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DriveRowActions>
    </MotionTableRow>
  );
}
