"use client";

import { useChat } from "@ai-sdk/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { AlertTriangle, FileSearch, FileText, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatGreeting } from "@/features/chat/components/chat-greeting";
import ChatSuggestions from "@/features/chat/components/chat-suggestions";
import { ChatThread } from "@/features/chat/components/chat-thread";
import { CitationToggle } from "@/features/chat/components/citation-toggle";
import { useChatCitations } from "@/features/chat/hooks/use-chat-citations";
import { useChatProvider } from "@/features/chat/hooks/use-chat-provider";
import {
  providersById,
  timestampsById,
  toUIMessages,
} from "@/features/chat/lib/messages";
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
  const [citations] = useChatCitations();

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

  /** What to call this document — see the composer's `attachment` below. */
  const documentName =
    data.content?.title ?? stripExtension(data.documentName);

  const initialMessages = useMemo(
    () => (data.chat ? toUIMessages(data.chat.messages) : []),
    [data.chat],
  );

  /** Which model wrote each stored answer — see the universal conversation. */
  const providers = useMemo(
    () => providersById(data.chat?.messages ?? []),
    [data.chat],
  );


  /** When each stored message was written — see `timestampsById`. */
  const timestamps = useMemo(
    () => timestampsById(data.chat?.messages ?? []),
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
              isStreaming: data.chat.isStreaming,
            },
          }
        : undefined,
    // The row itself — see the note in `chat-conversation`.
    [data.chat, chatId],
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
  /*
    The same preference the main chat's bar sets.

    This panel has no bar of its own to put the toggle in — it is a tab inside
    the work page, and its only chrome is the composer — but it reads the value
    all the same. Someone who turned citations off in the chat page and then
    opened a document would otherwise find them back on with no way to see why.
  */
  const clientData = useMemo(
    () => ({ provider, cite: citations }),
    [provider, citations],
  );

  const transport = useTriggerChatTransport<typeof studyChat>({
    task: "study-chat",
    clientData,
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
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    // Only where a turn is actually in flight — see the universal
    // conversation, which explains what asking on "has messages" cost.
    resume: data.chat?.isStreaming ?? false,
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
            // The same name the composer's attachment shows, from the same
            // place — the greeting and the label must not call one document two
            // different things.
            title={documentName}
            subtitle="Ask anything about this document. I only answer from this one — for questions across everything you have uploaded, use the main chat."
            className="max-w-md"
          />

          <ChatSuggestions
            suggestions={SUGGESTIONS}
            onSuggestion={(question) =>
              sendMessage({ text: question })
            }
            className="mt-6"
          />
        </motion.div>
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
          contentClassName="px-3 py-4"
        />
      )}

      <div className="shrink-0 p-3">
        <ChatComposer
          onSubmit={(question) => sendMessage({ text: question })}
          onStop={stop}
          isStreaming={isStreaming}
          provider={provider}
          onProviderChange={setProvider}
          disabled={isStreaming}
          // The narrowest surface the composer appears on, and the one sharing
          // its height with a document — see `ComposerSize`.
          size="compact"
          placeholder="Ask about this document…"
          // No `@` picker here: this conversation can only search the document
          // it belongs to, so a menu of the others would offer references it is
          // bound to refuse. The universal chat is where a file is chosen.
          mentions={false}
          /*
            Names the one document this chat can answer from.

            Worth the room because the two chats look identical and behave very
            differently: this one refuses anything outside its document, and
            without a label that refusal reads as the assistant being unable to
            answer rather than as it being scoped on purpose. Sitting on the
            composer rather than at the top of the panel keeps it in view at the
            moment the question is written, which is when it matters.

            The printed title where the reading found one, the file name
            otherwise — the same order the greeting uses, so the panel calls the
            document one thing throughout.
          */
          attachment={
            <>
              <FileText className="size-3.5 shrink-0 fill-orange-400 stroke-orange-200" />
              {/*
                `min-w-0` alongside the truncation, which without it does
                nothing: a flex item defaults to `min-width: auto`, so a
                `whitespace-nowrap` span refuses to shrink below the full width
                of its text and overflows the strip instead of ellipsising. It
                mattered less when the name was the only thing on this row; now
                that it has a button to share the space with, a long title would
                push the toggle out of the panel.
              */}
              <span className="min-w-0 truncate" title={documentName}>
                {documentName}
              </span>
              {/*
                Citations, at the far end of the strip naming the file.

                This panel has no bar of its own to put it in, and this is the
                right row for it: the strip already says what the chat is
                reading, and whether the answers link back into that file is the
                same kind of fact about this conversation.

                `ml-auto` rather than sitting flush against the name, so it
                cannot end up wherever a short filename happens to stop —
                anchored to the right edge it is in the same place on every
                document, and it is the same gesture the composer already makes
                with its picker and send button one row below.
              */}
              <CitationToggle labelled={false} className="ml-auto shrink-0" />
            </>
          }
        />
      </div>
    </div>
  );
}
