"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { useEffect, useMemo } from "react";

import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatGreeting } from "@/features/chat/components/chat-greeting";
import ChatSuggestions from "@/features/chat/components/chat-suggestions";
import { ChatThread } from "@/features/chat/components/chat-thread";
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
  const providers = useMemo(
    () => providersById(chat?.messages ?? []),
    [chat],
  );


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
   * instead of replaying or restarting. Absent for a chat with no live run —
   * a brand new one, or one whose run has since ended.
   */
  const sessions = useMemo(
    () =>
      chat?.sessionToken
        ? {
            [chatId]: {
              publicAccessToken: chat.sessionToken,
              lastEventId: chat.lastEventId ?? undefined,
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
  const clientData = useMemo(() => ({ provider }), [provider]);

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
     * A brand new chat has no run behind it, and asking to resume one produces
     * a subscription that waits for a stream nobody is writing.
     */
    resume: initialMessages.length > 0,
    onFinish: () => {
      // The recents list is now stale twice over — a new chat is missing from
      // it, and an existing one has moved to the top with a new title.
      void queryClient.invalidateQueries(trpc.chat.list.queryFilter());
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

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
            onSuggestion={(question) =>
              sendMessage({ text: question })
            }
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
          onRetryMessage={(messageId) =>
            regenerate({ messageId })
          }
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
