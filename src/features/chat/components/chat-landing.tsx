"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatGreeting } from "@/features/chat/components/chat-greeting";
import { useChatProvider } from "@/features/chat/hooks/use-chat-provider";
import { chatPath, newChatId } from "@/features/chat/types";
import { useChatDraftStore } from "@/lib/stores/chat-draft-store";

/**
 * The chat page before anything has been asked.
 *
 * A greeting and a box in the middle of the screen, with the recents table
 * peeking underneath — see `chat-view`, which composes the two.
 *
 * Asking a question here does not talk to the server. It mints an id, stashes
 * the question, and routes to `/chat/<id>`, where the conversation page picks it
 * up and sends it. That indirection is the whole reason this feels instant: the
 * alternative is a round trip to create a row before the user can be shown
 * anything, which is a visible stall at the exact moment the app should feel
 * fastest. The row is created by the streaming request itself.
 */

/**
 * What a new user is offered.
 *
 * Deliberately about *their* documents rather than about the assistant. Each
 * one demonstrates a different thing it can do — find across documents,
 * summarise one, pull structure out — so the set doubles as an explanation of
 * what this page is for.
 */
const SUGGESTIONS = [
  "What are my documents about?",
  "Summarise the key concepts I need to revise",
  "Make me a study plan from my documents",
];

export function ChatLanding() {
  const router = useRouter();
  const [provider, setProvider] = useChatProvider();
  const stage = useChatDraftStore((state) => state.stage);

  /**
   * The route is warmed as soon as this page is idle.
   *
   * `/chat/[chatId]` is dynamic, so its JavaScript is not part of this page's
   * bundle — and it is where every single visitor to this page is going next.
   * Fetching it now means the navigation on send is a render rather than a
   * download. The id is a throwaway: what is being prefetched is the route
   * segment, which is shared by every chat.
   */
  useEffect(() => {
    router.prefetch(chatPath("prefetch"));
  }, [router]);

  const start = useCallback(
    (question: string) => {
      const chatId = newChatId();
      stage(chatId, question);
      router.push(chatPath(chatId));
    },
    [router, stage],
  );

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6 px-4">
      <ChatGreeting
        subtitle="Ask anything about the documents you have uploaded. I will search them and tell you which page the answer came from."
        suggestions={SUGGESTIONS}
        onSuggestion={start}
      />

      <ChatComposer
        onSubmit={start}
        provider={provider}
        onProviderChange={setProvider}
        autoFocus
      />
    </div>
  );
}
