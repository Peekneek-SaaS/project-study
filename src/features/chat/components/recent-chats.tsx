"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProviderLogo } from "@/features/chat/components/provider-logo";
import { chatPath, type ChatSummary } from "@/features/chat/types";
import { listContainer, listItem, mountAnimation } from "@/lib/motion";
import { PROVIDER_INFO, isAiProvider } from "@/lib/ai/types";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Past conversations, parked under the fold.
 *
 * The heading sits just inside the viewport with the rows below it — enough to
 * say "your history is down here" without competing with the thing the page is
 * for, which is asking a new question. Someone who came to ask something is not
 * made to scroll past a list first; someone who came to find an old answer has
 * an obvious handle to pull.
 *
 * The header is `sticky` so it stays put once the list is scrolled into view,
 * which is what turns a peek into a heading.
 */

/** Row-level actions. Kept out of the row's own click target. */
function ChatRowMenu({ chat }: { chat: ChatSummary }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const remove = useMutation(trpc.chat.remove.mutationOptions());

  const handleDelete = useCallback(async () => {
    try {
      await remove.mutateAsync({ id: chat.id });
      await queryClient.invalidateQueries(trpc.chat.pathFilter());
      toast.success("Chat deleted");
    } catch {
      toast.error("Could not delete that chat.");
    }
  }, [chat.id, queryClient, remove, trpc]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Actions for ${chat.title}`}
          // The row is a link, so a press here must not also follow it.
          onClick={(event) => event.stopPropagation()}
          className="size-7 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            void handleDelete();
          }}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RecentChats() {
  const trpc = useTRPC();
  const router = useRouter();
  const { data: chats } = useSuspenseQuery(trpc.chat.list.queryOptions());

  // Warmed on hover rather than on mount. Prefetching thirty conversations
  // because a list of them was rendered would fetch a great deal that will
  // never be read; hovering a row is the earliest honest signal of intent, and
  // it buys the whole gap between the pointer arriving and the click.
  const [prefetched, setPrefetched] = useState<Set<string>>(new Set());

  const warm = useCallback(
    (chatId: string) => {
      if (prefetched.has(chatId)) return;
      setPrefetched((previous) => new Set(previous).add(chatId));
      router.prefetch(chatPath(chatId));
    },
    [prefetched, router],
  );

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
        A plain `table`, deliberately not the `Table` component. That one wraps
        itself in `overflow-x-auto`, which makes the browser compute
        `overflow-y` as `auto` too — and a `sticky` heading inside a scroll
        container sticks to *that* container rather than to the page. Since the
        container is exactly as tall as the table, the heading would never
        appear to stick at all, which is the one thing this list needs it to do.

        Nothing is lost: every column here is fixed width or truncates, so there
        is no horizontal overflow to scroll.
      */}
      <table className="w-full caption-bottom text-xs">
        <TableHeader className="sticky top-(--chat-sticky-top) z-20 bg-background">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-xs font-medium">
              Recent chats
            </TableHead>
            <TableHead className="hidden h-10 w-32 text-xs font-medium sm:table-cell">
              Model
            </TableHead>
            <TableHead className="h-10 w-32 text-end text-xs font-medium">
              Last active
            </TableHead>
            {/* Unlabelled: the column holds the row menu, and "Actions" as a
                heading is noise a screen reader has to read past on every row. */}
            <TableHead className="h-10 w-10" />
          </TableRow>
        </TableHeader>

        {/*
          A `motion.tbody` rather than `TableBody` wrapped in a motion `div`:
          anything but a `tbody` between `table` and `tr` is invalid markup, and
          browsers silently reparent it — taking the animation with it.
        */}
        <motion.tbody
          {...mountAnimation}
          variants={listContainer}
          className="[&_tr:last-child]:border-0"
        >
          {chats.map((chat) => (
            <motion.tr
              key={chat.id}
              variants={listItem}
              onMouseEnter={() => warm(chat.id)}
              onFocus={() => warm(chat.id)}
              className="group/row border-b transition-colors hover:bg-muted/40"
            >
              <TableCell className="max-w-0 py-2.5">
                {/*
                  The link fills the cell so the whole row is a click target,
                  while still being a real anchor — middle-click, ⌘-click and
                  "open in new tab" all work, which a div with an onClick would
                  quietly break.
                */}
                <Link
                  href={chatPath(chat.id)}
                  prefetch={false}
                  className="flex items-center gap-2.5 truncate outline-none"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {chat.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {chat.messageCount}
                  </span>
                </Link>
              </TableCell>

              <TableCell className="hidden py-2.5 text-xs text-muted-foreground sm:table-cell">
                {isAiProvider(chat.provider) ? (
                  <span className="flex items-center gap-1.5">
                    <ProviderLogo provider={chat.provider} labelled={false} />
                    {PROVIDER_INFO[chat.provider].label}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>

              <TableCell className="py-2.5 text-end text-xs whitespace-nowrap text-muted-foreground">
                {/* Wrapped because this arrives as an ISO string, not a
                    `Date` — there is no transformer on the tRPC client. */}
                {formatDistanceToNow(new Date(chat.updatedAt), {
                  addSuffix: true,
                })}
              </TableCell>

              <TableCell className="py-2.5 text-end">
                <ChatRowMenu chat={chat} />
              </TableCell>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}

/** The list's shape while it loads, so the peek does not jump into place. */
export function RecentChatsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 pb-16")}>
      <div className="flex h-10 items-center border-b">
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
