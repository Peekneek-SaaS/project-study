"use client";

import { isToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import { Check, Copy, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { memo, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChatMarkdown } from "@/features/chat/components/chat-markdown";
import { ChatToolActivity } from "@/features/chat/components/chat-tool-activity";
import { ProviderLogo } from "@/features/chat/components/provider-logo";
import { messageText } from "@/features/chat/lib/messages";
import { PROVIDER_INFO, isAiProvider } from "@/lib/ai/types";
import { fadeUp, mountAnimation } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One turn.
 *
 * Asymmetric on purpose, the way every chat worth using is: the question sits
 * in a bubble on the right because it is a short thing the user already knows
 * the content of, and the answer runs full width with no container at all
 * because it is the thing they are here to read. Wrapping a six-paragraph
 * explanation in a tinted box would narrow it for no reason and make it look
 * like a quotation rather than the page's content.
 */

/** Copies an answer, and says so for a moment. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // No cleanup on unmount: the timer only calls `setCopied`, and the worst
      // case is a state update on a component React has already discarded,
      // which it ignores.
      setTimeout(() => setCopied(false), 1_600);
    } catch {
      // Clipboard access denied — an insecure origin, or a browser that asks.
      // Nothing useful to say about it that the user could act on.
    }
  }, [text]);

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy answer"}
      // Revealed on hover on a pointer device, always present for touch and
      // keyboard — where there is no hover to reveal it with.
      className="size-7 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100 max-md:opacity-100"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming = false,
  provider,
  onRetry,
}: {
  message: UIMessage;
  /** True only for the last assistant message while tokens are arriving. */
  isStreaming?: boolean;
  /**
   * Throws this answer away and asks the same question again.
   *
   * Passed only to the *last* answer in the conversation, and only while
   * nothing is streaming — see `ChatThread`, which decides both. An answer with
   * turns after it cannot be retried, because the durable agent trims its own
   * history by popping trailing assistant messages until it reaches a user
   * message: it has no way to reach back into the middle. Offering a button
   * there would leave the browser and the agent disagreeing about what was
   * said, which is a far worse outcome than not offering it.
   */
  onRetry?: () => void;
  /**
   * Which model wrote this, where it is known.
   *
   * Absent for a turn still streaming — the answer is not finished, so nothing
   * has been recorded about it yet — and for messages from before this was
   * tracked. Both render without the mark rather than guessing at one.
   */
  provider?: string | null;
}) {
  const isUser = message.role === "user";
  const text = messageText(message);

  if (isUser) {
    return (
      <motion.div
        {...mountAnimation}
        variants={fadeUp}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
          {text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...mountAnimation}
      variants={fadeUp}
      className="group/message flex flex-col gap-1"
    >
      {message.parts.map((part, index) => {
        if (isToolUIPart(part)) {
          return (
            <ChatToolActivity
              // Index-keyed deliberately: parts are append-only within a
              // message and never reordered, so the index is stable for the
              // lifetime of the element — and tool parts have no id of their
              // own to key by.
              key={`tool-${index}`}
              part={part as ToolUIPart}
            />
          );
        }

        if (part.type === "reasoning") {
          // Rendered quietly rather than prominently. It is the model thinking
          // aloud, which is worth being able to see and is not the answer.
          return (
            <p
              key={`reasoning-${index}`}
              className="text-xs whitespace-pre-wrap text-muted-foreground/80 italic"
            >
              {part.text}
            </p>
          );
        }

        if (part.type === "text") {
          return <ChatMarkdown key={`text-${index}`}>{part.text}</ChatMarkdown>;
        }

        return null;
      })}

      {/*
        The cursor, shown only while this message is the one being written. A
        pulse rather than a spinner: it belongs to the sentence it is at the end
        of, and reads as "still writing" rather than "loading something".
      */}
      {isStreaming && text.length > 0 && (
        <motion.span
          aria-hidden
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block h-4 w-[2px] shrink-0 self-start rounded-full bg-foreground/70"
        />
      )}

      {/* Nothing to copy until there is an answer, and nothing to copy from a
          message still being written. */}
      {!isStreaming && text.length > 0 && (
        <div className={cn("-ms-1 flex items-center gap-1 pt-0.5")}>
          <CopyButton text={text} />

          {/*
            Discards this answer and asks the same question again.

            The question is not re-sent from the composer, and that is the point:
            `regenerate` slices the answer out of the conversation and re-runs
            the turn from the user message above it, so the transcript ends up
            with one answer rather than the same question asked twice.
          */}
          {onRetry && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onRetry}
              aria-label="Try this answer again"
              title="Try again"
              // Revealed the same way the copy button is: on hover for a
              // pointer, always present for touch and keyboard, where there is
              // no hover to reveal it with.
              className="size-7 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100 max-md:opacity-100"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}

          {/*
            Which model wrote this. Worth showing per message rather than once
            per conversation: the picker can be changed mid-chat, and the
            fallback chain can change it without the user doing anything — so
            two answers side by side genuinely can come from different models.

            Sat with the copy button and revealed the same way, because it is
            provenance rather than content: available when looked for, never
            competing with the answer itself.
          */}
          {isAiProvider(provider) && (
            <span className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 max-md:opacity-100">
              <ProviderLogo provider={provider} labelled={false} />
              {PROVIDER_INFO[provider].label}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
});
