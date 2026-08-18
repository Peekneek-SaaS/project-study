"use client";

import type { ChatStatus, UIMessage } from "ai";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@/components/ui/message-scroller";
import { ChatMessage } from "@/features/chat/components/chat-message";
import { CHAT_COLUMN } from "@/features/chat/types";
import { fade, mountAnimation } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The transcript.
 *
 * Scrolling is `MessageScroller`'s job rather than an effect of our own. The
 * naive version — scroll to the bottom whenever `messages` changes — fights the
 * user the moment they scroll up to re-read something mid-answer, because every
 * token yanks them back down. This one sticks to the bottom while they are at
 * the bottom, lets go the moment they scroll away, and offers a button back.
 *
 * `content-visibility` on each item, set by `MessageScrollerItem`, is what
 * keeps a long conversation cheap: messages scrolled out of view are not laid
 * out at all, so the hundredth message costs what the first one did.
 */

/**
 * Carries a newly sent question to the top of the viewport.
 *
 * Not a jump to the bottom, which is what an autoscroller does on its own and
 * which lands the question at the very edge with the answer immediately shoved
 * off-screen underneath it. Bringing the question to the *top* instead opens the
 * whole viewport below it for the reply to fill, so the answer arrives into
 * space that is already looking at it — the movement every good chat makes on
 * send, and the reason it feels considered rather than jerky.
 *
 * Its own component because `useMessageScroller` only works inside the
 * provider, and the provider is rendered below by `ChatThread` itself.
 *
 * Keyed on the last user message's id rather than on the message count: a
 * streaming answer changes the count on almost every frame, and scrolling on
 * each one would fight the reader for the whole reply.
 */
function ScrollOnSend({
  lastUserMessageId,
  hasMessages,
}: {
  lastUserMessageId?: string;
  hasMessages: boolean;
}) {
  const { scrollToEnd, scrollToMessage } = useMessageScroller();
  const previous = useRef<string | undefined>(undefined);
  const landed = useRef(false);

  /**
   * Opening a conversation lands at the newest message, not the oldest.
   *
   * A chat is read from the bottom: what you came back for is the last thing
   * said, and starting at the first message means scrolling past the whole
   * history to reach it.
   *
   * Done explicitly rather than left to `defaultScrollPosition`, which is
   * already "end" and still lands short. The scroller measures `scrollHeight`
   * on the frame the messages first mount — before the markdown has laid out,
   * before KaTeX has replaced its formulae, and before the items with
   * `content-visibility: auto` have reported a real height. It jumps to the
   * bottom of a document that is a fraction of its eventual size, and the
   * content then grows underneath, leaving the view near the top.
   *
   * So it is asked twice: once now, and once on the next frame when those
   * heights are known. `autoScroll` on the provider covers everything after
   * that, re-pinning as late-loading content settles.
   */
  useEffect(() => {
    if (landed.current || !hasMessages) return;
    landed.current = true;

    scrollToEnd({ behavior: "auto" });
    const frame = requestAnimationFrame(() => scrollToEnd({ behavior: "auto" }));
    return () => cancelAnimationFrame(frame);
  }, [hasMessages, scrollToEnd]);

  useEffect(() => {
    if (!lastUserMessageId || lastUserMessageId === previous.current) return;

    const isFirstRender = previous.current === undefined;
    previous.current = lastUserMessageId;

    // The landing above already put an opened conversation at the bottom;
    // animating there as well would travel twice.
    if (isFirstRender) return;

    scrollToMessage(lastUserMessageId, {
      align: "start",
      behavior: "smooth",
      // A sliver of the previous turn stays visible, so the movement reads as
      // the page travelling rather than the content being replaced.
      scrollMargin: 12,
    });
  }, [lastUserMessageId, scrollToMessage]);

  return null;
}

/** The three-dot wait between sending a question and the first token. */
function ThinkingIndicator() {
  return (
    <motion.div
      {...mountAnimation}
      variants={fade}
      className="flex items-center gap-1.5 py-1"
      aria-label="Thinking"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="size-1.5 rounded-full bg-muted-foreground/50"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: "easeInOut",
            // Staggered so the three read as one travelling wave rather than
            // three things blinking in unison.
            delay: index * 0.15,
          }}
        />
      ))}
    </motion.div>
  );
}

export function ChatThread({
  messages,
  status,
  error,
  onRetry,
  providers,
  onRetryMessage,
  className,
  contentClassName,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  error?: Error;
  onRetry?: () => void;
  /**
   * Which model wrote each answer, by message id.
   *
   * Carried alongside the messages rather than inside them because it is not
   * part of the conversation — the AI SDK's `UIMessage` has no room for it, and
   * it is only known once the turn has been recorded. A message missing from
   * this map simply renders without a mark.
   */
  providers?: Record<string, string | null>;
  /**
   * Discards an answer and re-runs the turn that produced it.
   *
   * Offered on the last answer only. The durable agent trims its own history by
   * popping trailing assistant messages until it reaches a user message, so it
   * can regenerate the tail and nothing else — a button on an older answer
   * would leave the browser's transcript and the agent's disagreeing.
   */
  onRetryMessage?: (messageId: string) => void;
  className?: string;
  contentClassName?: string;
}) {
  const last = messages[messages.length - 1];

  /**
   * Whether an answer can be thrown away and asked again right now.
   *
   * Withheld mid-turn: a regenerate while something is already streaming would
   * be two turns racing to write the same tail.
   */
  const canRetry =
    onRetryMessage !== undefined &&
    status !== "streaming" &&
    status !== "submitted";

  // Searched from the end, so this is the question just asked rather than the
  // first one in the conversation.
  const lastUserMessageId = messages.findLast(
    (message) => message.role === "user",
  )?.id;

  /**
   * Whether to show the dots.
   *
   * The test is "has the answer started *saying* anything", not "does the
   * message have parts yet". Those come apart badly with tools: the first thing
   * an assistant message gains is a tool call, so a parts-length test stopped
   * the indicator the instant the model began searching — leaving a long,
   * silent gap before any prose, which reads as the answer having failed. The
   * searches are shown, but they are the model working, not the model replying.
   *
   * So the dots stay up until a text part actually has characters in it, which
   * is the exact moment the reply begins and the exact moment they stop being
   * needed.
   */
  const hasStartedAnswering =
    last?.role === "assistant" &&
    last.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    );

  const isThinking =
    status === "submitted" ||
    (status === "streaming" && !hasStartedAnswering);

  return (
    /*
      `autoScroll` keeps the view pinned to the newest message while one is
      being written, and re-pins it whenever content grows underneath — a
      markdown table finishing its layout, a formula being typeset, an image
      arriving. Without it the scroller starts in "free-scrolling" mode and
      never corrects itself, which is what left an opened chat sitting near the
      top. It yields the moment the reader scrolls away, so it cannot fight
      someone re-reading an earlier answer mid-stream.
    */
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <ScrollOnSend
        lastUserMessageId={lastUserMessageId}
        hasMessages={messages.length > 0}
      />
      <MessageScroller className={cn("min-h-0 flex-1", className)}>
        {/*
          No visible bar, but every bit of the scrolling.
          `no-scrollbar` sets `scrollbar-width: none` and hides the WebKit
          pseudo-element; it touches nothing about `overflow`, so wheel,
          trackpad, touch, keyboard and `scrollIntoView` all behave exactly as
          before — as does the autoscroll that pins this to the newest message.

          Applied here rather than relied upon from the global rule in
          `globals.css`: that one lives in `@layer base`, which any utility
          class outranks, and this viewport arrives from the shared component
          carrying `scrollbar-thin` and friends. Those happen to be no-ops today
          — Tailwind v4 ships no scrollbar utilities and no plugin defines them
          — but they are written as an opt-in to a visible bar, and the moment
          such a plugin is added they would become one. Saying it explicitly
          here means this thread's answer does not depend on that.

          The `scroll-fade-b` already on the viewport is what puts the "there is
          more below" hint back, which is the affordance a hidden bar costs.
        */}
        <MessageScrollerViewport className="no-scrollbar">
          <MessageScrollerContent
            // The same measure the composer uses, from the same constant, so
            // the two can never disagree about how wide a chat is.
            className={cn(CHAT_COLUMN, "gap-6 px-4 py-6", contentClassName)}
          >
            {messages.map((message, index) => (
              <MessageScrollerItem
                key={message.id}
                // Named so `ScrollOnSend` can bring this exact message to the
                // top of the viewport.
                messageId={message.id}
                // The anchor the scroller keeps pinned to the bottom. Only the
                // last message is one, so growing earlier messages — which
                // happens when a tool result lands — does not drag the view.
                scrollAnchor={index === messages.length - 1}
              >
                <ChatMessage
                  message={message}
                  isStreaming={
                    status === "streaming" && index === messages.length - 1
                  }
                  provider={providers?.[message.id]}
                  // The last message, and only when it is an answer: there is
                  // nothing to regenerate about a question.
                  onRetry={
                    canRetry &&
                    index === messages.length - 1 &&
                    message.role === "assistant"
                      ? () => onRetryMessage(message.id)
                      : undefined
                  }
                />
              </MessageScrollerItem>
            ))}

            {isThinking && (
              <MessageScrollerItem scrollAnchor>
                <ThinkingIndicator />
              </MessageScrollerItem>
            )}

            {error && (
              <MessageScrollerItem>
                <motion.div
                  {...mountAnimation}
                  variants={fade}
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm text-foreground">
                      {/* The route's `onError` already turned this into
                          something readable; anything else is a network
                          failure, which needs its own words. */}
                      {error.message ||
                        "Something went wrong. Please try again."}
                    </p>
                    {onRetry && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onRetry}
                        className="w-fit"
                      >
                        Try again
                      </Button>
                    )}
                  </div>
                </motion.div>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
