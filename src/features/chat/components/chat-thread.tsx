"use client";

import type { ChatStatus, UIMessage } from "ai";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { AnswerSelectionProvider } from "@/features/chat/components/answer-selection";
import { ChatMessage } from "@/features/chat/components/chat-message";
import { useChatScroll } from "@/features/chat/hooks/use-chat-scroll";
import { CHAT_COLUMN } from "@/features/chat/types";
import { fade, mountAnimation } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The transcript.
 *
 * The scrolling is `useChatScroll`'s — read that first; the rule it implements
 * is the whole behaviour of this component, and the markup below exists mostly
 * to give it the four elements it measures against.
 */

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
  timestamps,
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
   * When each stored message was written, by message id. Missing for a turn
   * still in flight, which `ChatMessage` covers with its own mount time.
   */
  timestamps?: Record<string, string | Date>;
  /**
   * Discards an answer and re-runs the turn that produced it.
   *
   * Offered on the last answer only. The durable agent trims its own history by
   * popping trailing assistant messages until it reaches a user message, so it
   * can regenerate the tail and nothing else.
   */
  onRetryMessage?: (messageId: string) => void;
  className?: string;
  contentClassName?: string;
}) {
  const last = messages[messages.length - 1];

  /** The newest question — what the spacer is measured from. */
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  const lastUserId = lastUserIndex >= 0 ? messages[lastUserIndex].id : undefined;

  /**
   * A number that changes on every token.
   *
   * The message array is replaced on each chunk, but its *identity* is not
   * something an effect can depend on cheaply. Total text length is: it grows
   * monotonically as an answer streams and is stable once it stops, which is
   * exactly when the view should follow and when it should stop.
   */
  const revision = useMemo(
    () =>
      messages.reduce(
        (total, message) =>
          total +
          message.parts.reduce(
            (parts, part) =>
              parts + (part.type === "text" ? part.text.length : 1),
            0,
          ),
        messages.length,
      ),
    [messages],
  );

  const {
    viewportRef,
    contentRef,
    spacerRef,
    anchorRef,
    isFollowingRef,
    scrollToBottom,
  } = useChatScroll({ turnKey: lastUserId, revision });

  /**
   * Whether to offer a way back down.
   *
   * Mirrored into state because the button has to re-render when it changes,
   * while the follow logic itself must not — hence the ref being the source of
   * truth and this being a copy of it, updated only when the answer is one the
   * button would change its mind about.
   */
  const [isAway, setIsAway] = useState(false);

  /**
   * Whether the model has started replying.
   *
   * The dots stay up until a text part actually has characters in it, which is
   * the exact moment the reply begins. A parts-length test would stop them the
   * instant the model began *searching*, leaving a long silent gap before any
   * prose — which reads as the answer having failed.
   */
  const hasStartedAnswering =
    last?.role === "assistant" &&
    last.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    );

  const isThinking =
    status === "submitted" ||
    (status === "streaming" && !hasStartedAnswering);

  const canRetry =
    onRetryMessage !== undefined &&
    status !== "streaming" &&
    status !== "submitted";

  return (
    /*
      One toolbar for the whole transcript rather than one per answer: a
      selection can only be in one place at a time, so a provider per message
      would be a hundred listeners agreeing that ninety-nine have nothing to
      show. It renders `contents`, so it adds no box to the layout.
    */
    <AnswerSelectionProvider>
      <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
        <div
          ref={viewportRef}
          // `no-scrollbar` hides the bar and touches nothing about `overflow`,
          // so wheel, trackpad, touch, keyboard and every programmatic scroll
          // above behave exactly as they did. `scroll-fade-b` is what puts the
          // "there is more below" hint back in its place.
          className="no-scrollbar scroll-fade-b min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onScroll={() => {
            // Read from the ref the scroll listener already maintains, so the
            // button and the follow logic can never disagree about where the
            // reader is.
            const away = !isFollowingRef.current;
            setIsAway((current) => (current === away ? current : away));
          }}
        >
          <div
            ref={contentRef}
            className={cn(CHAT_COLUMN, "flex flex-col gap-6 px-4 py-6", contentClassName)}
          >
            {messages.map((message, index) => (
              <div
                key={message.id}
                // The newest question carries the anchor the spacer is measured
                // from. Everything else is an ordinary block.
                ref={index === lastUserIndex ? anchorRef : undefined}
                /*
                  Deliberately no `content-visibility: auto` here, tempting as
                  it is for a long transcript. It gives off-screen messages an
                  *estimated* height, so `scrollHeight` changes as they are
                  scrolled past and swap their guess for the real thing — which
                  moves the content under a reader who is scrolling, and
                  mismeasures the spacer this component depends on. Correct
                  scrolling is worth more here than laying out fewer messages.
                */
              >
                <ChatMessage
                  message={message}
                  isStreaming={
                    status === "streaming" && index === messages.length - 1
                  }
                  provider={providers?.[message.id]}
                  createdAt={timestamps?.[message.id]}
                  onRetry={
                    canRetry &&
                    index === messages.length - 1 &&
                    message.role === "assistant"
                      ? () => onRetryMessage(message.id)
                      : undefined
                  }
                />
              </div>
            ))}

            {isThinking && <ThinkingIndicator />}

            {error && (
              <motion.div
                {...mountAnimation}
                variants={fade}
                className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm text-foreground">
                    {error.message || "Something went wrong. Please try again."}
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
            )}
          </div>

          {/*
            The room that lets a short turn still reach the top of the screen.
            Outside `contentRef` on purpose — it must not count towards the
            height being measured, or it would size itself.
          */}
          <div ref={spacerRef} aria-hidden />
        </div>

        {/* Only offered once the reader has actually left the bottom, and it
            resumes following rather than just jumping once. */}
        {isAway && (
          <motion.div
            {...mountAnimation}
            variants={fade}
            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
          >
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label="Scroll to the newest message"
              onClick={() => scrollToBottom("smooth")}
              className="pointer-events-auto rounded-full shadow-md"
            >
              <ArrowDown className="size-4" />
            </Button>
          </motion.div>
        )}
      </div>
    </AnswerSelectionProvider>
  );
}
