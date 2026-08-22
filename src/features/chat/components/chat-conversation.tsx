"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatGreeting } from "@/features/chat/components/chat-greeting";
import ChatSuggestions from "@/features/chat/components/chat-suggestions";
import { ChatThread } from "@/features/chat/components/chat-thread";
import { CitationToggle } from "@/features/chat/components/citation-toggle";
import { usePaywall } from "@/features/billing/hooks/use-paywall";
import { useRefreshEntitlements } from "@/features/billing/hooks/use-entitlements";
import { useChatCitations } from "@/features/chat/hooks/use-chat-citations";
import { useChatProvider } from "@/features/chat/hooks/use-chat-provider";
import {
  providersById,
  timestampsById,
  toUIMessages,
} from "@/features/chat/lib/messages";
import { UNIVERSAL_SUGGESTIONS } from "@/features/chat/lib/suggestions";
import {
  clearChatSession,
  mintChatAccessToken,
  startStudyChatSession,
} from "@/features/chat/server/actions";
import { CHAT_PATH } from "@/features/chat/types";
import { useChatDraftStore } from "@/lib/stores/chat-draft-store";
import { useTRPC } from "@/trpc/client";
// Type-only, so nothing from the worker bundle reaches the browser. It is what
// gives `task: "study-chat"` compile-time validation against the real agent.
import type { studyChat } from "@/trigger/chat";

/**
 * One universal conversation.
 *
 * The answering does not happen here, and it does not happen in a request
 * either: it happens in a durable Trigger.dev run that this page *watches*.
 * That is the difference between a chat you have to sit and wait for and one
 * you can walk away from. Ask a long question, go and read a document, come
 * back — the answer either finished while you were gone or is still arriving,
 * and either way this picks it up mid-flight rather than starting again.
 *
 * The transcript still scrolls and the composer is still pinned to the bottom.
 * Everything visible is unchanged; what changed is who owns the work.
 */
export function ChatConversation({ chatId }: { chatId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useChatProvider();
  const refreshEntitlements = useRefreshEntitlements();
  const { reportError } = usePaywall();
  const [citations] = useChatCitations();

  const { data: chat } = useSuspenseQuery(
    trpc.chat.get.queryOptions({ id: chatId }),
  );

  const initialMessages = useMemo(
    () => (chat ? toUIMessages(chat.messages) : []),
    [chat],
  );

  /**
   * Which model wrote each stored answer.
   *
   * Only ever from the database, never guessed from the picker: the chain can
   * fall through to a second provider without the user touching anything, so
   * the selected model and the one that actually answered are different
   * questions. A mark that is merely probably right would be worse than none.
   */
  const providers = useMemo(() => providersById(chat?.messages ?? []), [chat]);

  /** When each stored message was written — see `timestampsById`. */
  const timestamps = useMemo(
    () => timestampsById(chat?.messages ?? []),
    [chat],
  );

  /**
   * Where the run had got to when this page was last closed.
   *
   * Handing this to the transport is what turns "reload the page" into "rejoin
   * the stream": with a token and a cursor it resubscribes past everything
   * already seen, so a half-written answer continues from the word it was on
   * instead of replaying or restarting.
   *
   * `isStreaming` is passed with them because the transport uses it to skip the
   * reconnect entirely on a settled chat. Without it, every visit to every past
   * conversation opens an SSE and waits for the server to say "nothing here" —
   * which is what a spinner over a finished answer was.
   */
  const sessions = useMemo(
    () =>
      chat?.sessionToken
        ? {
            [chatId]: {
              publicAccessToken: chat.sessionToken,
              lastEventId: chat.lastEventId ?? undefined,
              isStreaming: chat.isStreaming,
            },
          }
        : undefined,
    // The whole row, not its two fields: the compiler tracks what the body
    // actually reads, and naming sub-properties it cannot follow makes it
    // give up on the memo entirely.
    [chat, chatId],
  );

  /**
   * The picker's choice, as the agent's client data.
   *
   * On the transport rather than passed per message, because that is the only
   * place this transport reads it: its wire payload always carries
   * `this.clientData`, and the `metadata` argument to `sendMessage` — which the
   * plain HTTP transport does honour — is silently dropped here. Sent that way,
   * every turn reached the agent with no provider at all, so the chain started
   * at its default and OpenAI answered whatever the picker said.
   *
   * The transport is still never rebuilt: `useTriggerChatTransport` keeps this
   * up to date through `setClientData`, so changing model mid-conversation
   * cannot orphan a stream in flight.
   */
  const clientData = useMemo(
    () => ({ provider, cite: citations }),
    [provider, citations],
  );

  const transport = useTriggerChatTransport<typeof studyChat>({
    task: "study-chat",
    clientData,
    // Called only when a token is refused as expired. The action re-checks
    // ownership before minting, because this is the one call the browser can
    // make unprompted.
    accessToken: ({ chatId: id }) => mintChatAccessToken(id),
    // Creates the chat row and its durable session on the first message, and
    // no-ops on every message after.
    startSession: ({ chatId: id, clientData }) =>
      startStudyChatSession({ chatId: id, clientData, provider }),
    sessions,
    onSessionChange: (id, session) => {
      // Null means the run behind this chat has ended. Forgetting the cursor
      // stops the next visit waiting on a stream that will never speak again.
      if (!session) void clearChatSession(id);
    },
  });

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    /**
     * Reconnect on mount, but only where there is something to reconnect to.
     *
     * "Has messages" is not that something. A session outlives the runs inside
     * it, so a chat answered last week still has a token and a cursor, and
     * resuming on those means every past conversation reopens a stream with
     * nothing to say. `useChat` goes to `submitted` the moment it is asked to
     * resume — so the transcript showed a thinking indicator and the composer
     * showed Stop, on a conversation that finished days ago.
     *
     * The flag is written by the run on both edges of a turn, so it stays right
     * when the tab that asked the question is long gone — which is exactly the
     * case this has to survive: ask, navigate away, come back.
     */
    resume: chat?.isStreaming ?? false,
    onFinish: () => {
      // An answer costs credits, and the meter has no other way of knowing.
      // The turn is billed inside the run — see `trigger/chat.ts` — so the
      // number in the sidebar is one behind until something asks again, and
      // this is the moment it is certainly worth asking.
      refreshEntitlements();

      // The recents list is now stale twice over — a new chat is missing from
      // it, and an existing one has moved to the top with a new title.
      // `pathFilter`, not `list.queryFilter()`: the recents list is an
      // infinite query now, and its key carries `type: "infinite"` — which a
      // plain query filter does not match. The path filter matches every
      // variant, which also picks up the flat copy the search palette holds.
      void queryClient.invalidateQueries(trpc.chat.pathFilter());
      // And the transcript has gained a row this page has not read: the turn
      // just recorded says which model answered it. Refetching is what puts the
      // mark under the answer a moment after it lands. It cannot disturb what
      // is on screen — `useChat` keeps the messages it is already holding.
      void queryClient.invalidateQueries(
        trpc.chat.get.queryFilter({ id: chatId }),
      );
    },
  });
  /**
   * Sends the question that was asked on the previous page.
   *
   * `take` reads and clears in one call, which is what makes this safe under
   * React's development double-invoke: the second run finds nothing staged and
   * does nothing.
   */
  const takeDraft = useChatDraftStore((state) => state.take);

  useEffect(() => {
    const question = takeDraft(chatId);
    if (question) void sendMessage({ text: question });
  }, [chatId, sendMessage, takeDraft]);

  /*
    A turn refused for want of credits opens the offer, once.

    The run aborts with the reason as its message — see `spendCredits` in
    `trigger/chat.ts` — and it arrives here as `useChat`'s error. Watching the
    error object rather than calling from `onError` because a resumed stream
    that fails reports through this path too, and a question that cannot be
    answered should raise the same offer however it failed.

    `reportError` returns null for anything that is not a plan refusal, so
    ordinary failures — a provider outage, a dropped connection — still show as
    the error they are and open nothing.
  */
  useEffect(() => {
    if (error) reportError(error);
  }, [error, reportError]);

  const isStreaming = status === "streaming" || status === "submitted";

  /**
   * What to call this conversation in the bar.
   *
   * A chat opened from the landing page has no row yet — the id is minted in
   * the browser and written by the first question — so this stands in until the
   * title arrives, which it does on `onFinish`'s refetch a moment after the
   * first answer.
   */
  const title = chat?.title ?? "New chat";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        Which conversation this is, and the way back out of it.

        Worth a bar of its own here where it is not on the landing page: a
        conversation is a thing with a name, and the only other places that name
        appears are the browser tab and the recents list behind you. The way back
        matters most on a phone, where the sidebar is a sheet that has to be
        opened before it can be used.

        Capped rather than left to run: a chat is titled from its first question,
        so a long one is the normal case and not the exception. The whole of it
        is a hover away.
      */}
      <div className="flex h-11 shrink-0 items-center gap-1 px-2">
        <Button size="sm" variant="ghost" asChild aria-label="Back to chats">
          <Link href={CHAT_PATH}>
            <ArrowLeft />
          </Link>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
              <MessageSquare className="size-3.5 shrink-0 fill-emerald-500 stroke-emerald-500" />
              <span className="truncate">{title}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>

        {/*
          Pushed to the far end, away from the title it is not describing. The
          toggle is about how the *next* answer will be written, so it belongs
          with the conversation rather than with any one message in it.
        */}
        <CitationToggle className="ml-auto" />
      </div>

      {messages.length === 0 ? (
        /*
          A conversation nobody has spoken in yet.

          Reachable two ways, and both of them need this: "New Chat" in the
          create menu opens straight onto a fresh id, and so does a bookmarked
          chat that was abandoned before its first question. Left as a bare
          scroller it is an empty page with a box at the bottom, which reads as
          something that failed to load rather than something waiting for you.

          The same greeting the landing page shows, centred the same way the
          document panel centres its own — the composer drops to the bottom the
          moment there is a transcript to sit under.
        */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
          <ChatGreeting className="max-w-xl" />

          <ChatSuggestions
            suggestions={UNIVERSAL_SUGGESTIONS}
            onSuggestion={(question) => sendMessage({ text: question })}
            className="mt-6"
          />
        </div>
      ) : (
        <ChatThread
          messages={messages}
          status={status}
          error={error}
          onRetry={() => regenerate()}
          providers={providers}
          timestamps={timestamps}
          onRetryMessage={(messageId) => regenerate({ messageId })}
        />
      )}

      <div className="shrink-0 px-4 pb-4">
        <ChatComposer
          onSubmit={(question) => sendMessage({ text: question })}
          onStop={stop}
          isStreaming={isStreaming}
          provider={provider}
          onProviderChange={setProvider}
          // Sending while an answer is still arriving would interleave two
          // turns into one transcript. The stop button is offered instead.
          disabled={isStreaming}
          autoFocus
          // Under a transcript rather than alone on a page: every row this box
          // takes is a row of the answer above it that scrolls out of view.
          size="compact"
        />
      </div>
    </div>
  );
}
