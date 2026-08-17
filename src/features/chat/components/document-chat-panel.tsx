"use client";

import { useChat } from "@ai-sdk/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { AlertTriangle, FileSearch, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatGreeting } from "@/features/chat/components/chat-greeting";
import ChatSuggestions from "@/features/chat/components/chat-suggestions";
import { ChatThread } from "@/features/chat/components/chat-thread";
import { useChatProvider } from "@/features/chat/hooks/use-chat-provider";
import { providersById, toUIMessages } from "@/features/chat/lib/messages";
import {
  clearChatSession,
  mintChatAccessToken,
  startStudyChatSession,
} from "@/features/chat/server/actions";
import { documentChatId } from "@/features/chat/types";
import { fade, mountAnimation, popIn } from "@/lib/motion";
import { stripExtension } from "@/lib/document-file-types";
import { useTRPC } from "@/trpc/client";
// Type-only, so no worker code reaches the browser — it is what validates the
// task id below against the real agent.
import type { studyChat } from "@/trigger/chat";

/**
 * A document's own conversation, inside its work page.
 *
 * No route of its own and no chat id in the URL: the document's address already
 * identifies the conversation, because there is exactly one per document — see
 * the `@unique` on `Chat.documentId`. Coming back to a document comes back to
 * the same conversation, which is the behaviour the panel is for.
 *
 * What separates this from the universal chat is one field on the request. The
 * server takes `documentId` to mean "search this and refuse the rest"; the
 * composer, the transcript and the streaming are all the same components doing
 * the same thing.
 */

/**
 * What a document offers before anything has been asked of it.
 *
 * More specific than the landing page's, because here the assistant knows what
 * the document is: these are the three things people actually want from a
 * document they are about to study.
 */
const SUGGESTIONS = [
  "Summarise this document",
  "What are the key concepts here?",
  "Quiz me on this",
];

/** The states before there is anything to chat with. */
function PanelNotice({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      {...mountAnimation}
      variants={popIn}
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-xs text-xs text-balance text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </motion.div>
  );
}

export function DocumentChatPanel({ documentId }: { documentId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useChatProvider();

  const { data } = useSuspenseQuery({
    ...trpc.chat.forDocument.queryOptions({ documentId }),
    /**
     * Polled only while the document is being read.
     *
     * Reading a book takes minutes, and the panel has to notice when it
     * finishes — but polling a finished document forever would be a request
     * every few seconds for the life of the tab. The interval is a function of
     * the data, so it stops on its own the moment the status settles.
     */
    refetchInterval: (query) => {
      const status = query.state.data?.content?.status;
      return status === "PENDING" || status === "PROCESSING" ? 3_000 : false;
    },
  });

  const process = useMutation(trpc.chat.processDocument.mutationOptions());

  const startProcessing = async () => {
    try {
      await process.mutateAsync({ documentId, provider });
      await queryClient.invalidateQueries(
        trpc.chat.forDocument.queryFilter({ documentId }),
      );
    } catch {
      toast.error("Could not start reading this document.");
    }
  };

  /**
   * This document's conversation, by name.
   *
   * A chat that already exists answers to its own id — chats created before
   * this scheme have ordinary generated ones and must keep working. A document
   * that has never been chatted with has no row to read an id from, so the id
   * is derived from the document instead: both the browser and the server reach
   * the same string with no round trip, and the row is created under it on the
   * first message.
   */
  const chatId = data.chat?.id ?? documentChatId(documentId);

  const initialMessages = useMemo(
    () => (data.chat ? toUIMessages(data.chat.messages) : []),
    [data.chat],
  );

  /** Which model wrote each stored answer — see the universal conversation. */
  const providers = useMemo(
    () => providersById(data.chat?.messages ?? []),
    [data.chat],
  );

  /** Where the durable run had got to — see the universal conversation. */
  const sessions = useMemo(
    () =>
      data.chat?.sessionToken
        ? {
            [chatId]: {
              publicAccessToken: data.chat.sessionToken,
              lastEventId: data.chat.lastEventId ?? undefined,
            },
          }
        : undefined,
    // The row itself — see the note in `chat-conversation`.
    [data.chat, chatId],
  );

  const transport = useTriggerChatTransport<typeof studyChat>({
    task: "study-chat",
    accessToken: ({ chatId: id }) => mintChatAccessToken(id),
    // `documentId` is passed to the action rather than sent with each turn: it
    // is written onto the chat row once, and the agent reads the row. A client
    // cannot widen its own scope by asking, because per-turn payloads carry no
    // document at all.
    startSession: ({ chatId: id, clientData }) =>
      startStudyChatSession({ chatId: id, documentId, clientData, provider }),
    sessions,
    onSessionChange: (id, session) => {
      if (!session) void clearChatSession(id);
    },
  });

  /** The picker's choice, sent as the agent's per-turn client data. */
  const requestOptions = useMemo(() => ({ metadata: { provider } }), [provider]);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    // Only where there is a run to rejoin — see the universal conversation.
    resume: initialMessages.length > 0,
    onFinish: () => {
      // The stored transcript has changed underneath the query that seeded
      // this. Refetching keeps a remount — switching tabs and back — from
      // rendering the conversation as it was before the last answer.
      void queryClient.invalidateQueries(
        trpc.chat.forDocument.queryFilter({ documentId }),
      );
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Never read, and nothing has been asked to read it — a document that
  // predates chat, or one whose queueing failed.
  if (!data.content) {
    return (
      <PanelNotice
        icon={<FileSearch className="size-5" />}
        title="This document hasn't been read yet"
        description="Read it once and you can ask questions about it, with answers pointing at the exact pages."
        action={
          <Button size="sm" onClick={startProcessing} disabled={process.isPending}>
            {process.isPending ? "Starting…" : "Read this document"}
          </Button>
        }
      />
    );
  }

  if (data.content.status === "PENDING" || data.content.status === "PROCESSING") {
    return (
      <PanelNotice
        icon={<Spinner className="size-5" />}
        title="Reading this document"
        description="Working through the pages so answers can point at the right one. This takes a minute or two for a long document — you can carry on working meanwhile."
      />
    );
  }

  if (data.content.status === "FAILED") {
    return (
      <PanelNotice
        icon={<AlertTriangle className="size-5 text-destructive" />}
        title="This document couldn't be read"
        description={
          data.content.error ??
          "Something went wrong reading this document for chat."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={startProcessing}
            disabled={process.isPending}
          >
            <RefreshCw className={process.isPending ? "animate-spin" : ""} />
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {messages.length === 0 ? (
        // Centred until the conversation starts, exactly as the landing page
        // is — the composer moves to the bottom once there is a transcript to
        // sit under.
        <motion.div
          {...mountAnimation}
          variants={fade}
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-4"
        >
          <ChatGreeting
            title={
              data.content.title ?? stripExtension(data.documentName)
            }
            subtitle="Ask anything about this document. I only answer from this one — for questions across everything you have uploaded, use the main chat."
            className="max-w-md"
          />

          <ChatSuggestions
            suggestions={SUGGESTIONS}
            onSuggestion={(question) =>
              sendMessage({ text: question }, requestOptions)
            }
            className="mt-6"
          />
        </motion.div>
      ) : (
        <ChatThread
          messages={messages}
          status={status}
          error={error}
          onRetry={() => regenerate(requestOptions)}
          providers={providers}
          contentClassName="px-3 py-4"
        />
      )}

      <div className="shrink-0 p-3">
        <ChatComposer
          onSubmit={(question) => sendMessage({ text: question }, requestOptions)}
          onStop={stop}
          isStreaming={isStreaming}
          provider={provider}
          onProviderChange={setProvider}
          disabled={isStreaming}
          placeholder="Ask about this document…"
        />
      </div>
    </div>
  );
}
