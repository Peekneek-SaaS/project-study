"use client";

import type { ChatStatus, UIMessage } from "ai";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
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
  className?: string;
  contentClassName?: string;
}) {
  const last = messages[messages.length - 1];

  /**
   * Whether to show the dots.
   *
   * Only in the gap between the question landing and the answer starting — once
   * the assistant message exists and has content, the answer itself is the
   * indicator. `submitted` covers the request being in flight; `streaming` with
   * a still-empty assistant message covers the model having connected but not
   * yet said anything, which is where the tool calls happen and is the longest
   * part of the wait.
   */
  const isThinking =
    status === "submitted" ||
    (status === "streaming" &&
      last?.role === "assistant" &&
      last.parts.length === 0);

  return (
    <MessageScrollerProvider>
      <MessageScroller className={cn("min-h-0 flex-1", className)}>
        <MessageScrollerViewport>
          <MessageScrollerContent
            // The same measure the composer uses, from the same constant, so
            // the two can never disagree about how wide a chat is.
            className={cn(CHAT_COLUMN, "gap-6 px-4 py-6", contentClassName)}
          >
            {messages.map((message, index) => (
              <MessageScrollerItem
                key={message.id}
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
