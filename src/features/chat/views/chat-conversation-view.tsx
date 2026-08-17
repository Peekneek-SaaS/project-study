import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { ChatConversation } from "@/features/chat/components/chat-conversation";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * One conversation's page.
 *
 * Given a real height rather than left to `flex-1`, for the reason `work-view`
 * spells out at length: the shell above it is content-driven with a viewport
 * floor, so a column left to grow takes the whole window with it — here that
 * would mean a long transcript scrolling the page and carrying the composer off
 * the bottom of it. Claiming the viewport minus the header, and clipping,
 * leaves the transcript as the only thing that scrolls.
 *
 * The transcript is warmed on the server so a chat opened from the recents list
 * arrives with its messages already rendered rather than flashing a spinner
 * over a conversation the user can see the title of.
 */
export async function ChatConversationView({ chatId }: { chatId: string }) {
  await prefetchAwaited(trpc.chat.get.queryOptions({ id: chatId }));

  return (
    <div className="flex min-h-0 flex-col overflow-hidden [--chat-header-h:4rem] h-[calc(100svh-var(--chat-header-h))] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--chat-header-h:3rem]">
      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading this chat.">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <ChatConversation chatId={chatId} />
          </Suspense>
        </QueryErrorBoundary>
      </HydrateClient>
    </div>
  );
}
