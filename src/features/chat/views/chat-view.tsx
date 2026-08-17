import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { ChatLanding } from "@/features/chat/components/chat-landing";
import {
  RecentChats,
  RecentChatsSkeleton,
} from "@/features/chat/components/recent-chats";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * The chat page.
 *
 * Two bands stacked in one scroller: the greeting and the composer, sized to
 * fill the viewport minus a sliver, and the recents table starting in that
 * sliver. The sliver is the whole design — its only job is to put the table's
 * heading on screen so the history is discoverable, without letting a list of
 * old conversations compete with the box for asking a new one.
 *
 * The height is computed rather than measured: `100svh` minus the app header,
 * minus the peek. `svh` and not `vh` because on a phone the browser chrome
 * makes `vh` taller than the visible page, which would push the heading back
 * under the fold on exactly the devices with least room to spare.
 *
 * `prefetchAwaited` rather than bare `prefetch`, as everywhere else that warms a
 * query from a server component with nothing else to await — the long version
 * is in `trpc/server.tsx`.
 */
export async function ChatView() {
  await prefetchAwaited(trpc.chat.list.queryOptions());

  return (
    <div
      className={[
        // The offsets this page measures itself against. `--chat-header-h`
        // tracks the app header, which shrinks with a collapsed sidebar — the
        // same variable trick `main-view` and `work-view` use, and for the same
        // reason: a layout cannot ask its children how tall they turned out.
        "flex flex-1 flex-col [--chat-header-h:4rem] [--chat-peek:4.5rem]",
        "md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--chat-header-h:3rem]",
        // Where the recents header parks once it is scrolled to.
        "[--chat-sticky-top:var(--chat-header-h)]",
      ].join(" ")}
    >
      <section className="flex min-h-[calc(100svh-var(--chat-header-h)-var(--chat-peek))] flex-col items-center justify-center py-8">
        <ChatLanding />
      </section>

      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading your chats.">
          <Suspense fallback={<RecentChatsSkeleton />}>
            <RecentChats />
          </Suspense>
        </QueryErrorBoundary>
      </HydrateClient>
    </div>
  );
}
