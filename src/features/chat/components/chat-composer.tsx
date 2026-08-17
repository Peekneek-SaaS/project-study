"use client";

import { ArrowUp, Square } from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { ProviderPicker } from "@/features/chat/components/provider-picker";
import { CHAT_COLUMN } from "@/features/chat/types";
import { fastTransition } from "@/lib/motion";
import type { AiProvider } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

/**
 * Where questions are written.
 *
 * One component for every surface — the middle of the landing page, the bottom
 * of a conversation, the document panel — because they are the same control at
 * different sizes, and three of them would drift on the details that matter
 * most: what Enter does, when the send button is live, how the box grows.
 *
 * The height is managed by hand rather than left to `field-sizing: content`,
 * which cannot be given a maximum that scrolls. A composer that grows without
 * limit eventually pushes the conversation off the top of the screen.
 */

/** How tall the box may grow before it starts scrolling instead, in px. */
const MAX_HEIGHT = 220;

export function ChatComposer({
  onSubmit,
  onStop,
  isStreaming = false,
  provider,
  onProviderChange,
  placeholder = "Ask anything about your documents…",
  autoFocus = false,
  disabled = false,
  className,
}: {
  /** Given the question, trimmed and known non-empty. */
  onSubmit: (question: string) => void;
  /** Absent when there is nothing to stop — the button is send-only then. */
  onStop?: () => void;
  isStreaming?: boolean;
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  /**
   * Grows the box to fit what is in it.
   *
   * `useLayoutEffect` rather than `useEffect`: the height is measured from the
   * DOM and written back to it, and doing that after paint means one frame at
   * the old height on every keystroke that wraps a line.
   *
   * The reset to `auto` is what allows it to *shrink* — `scrollHeight` never
   * reports less than the current height, so measuring without clearing it
   * first makes a box that only ever gets taller.
   */
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const submit = useCallback(() => {
    const question = value.trim();
    if (!question || disabled) return;

    onSubmit(question);
    setValue("");
    // Kept focused: the overwhelmingly common next action is another question,
    // and a composer that loses focus after every send makes the user click
    // back into it each time.
    textareaRef.current?.focus();
  }, [disabled, onSubmit, value]);

  /**
   * Enter sends; Shift+Enter makes a new line.
   *
   * The IME check is what keeps this usable in languages that compose
   * characters: while a candidate is being chosen, Enter means "accept that
   * word", and sending on it would fire mid-word on every message.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.nativeEvent.isComposing) return;

      event.preventDefault();
      submit();
    },
    [submit],
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(
        // The whole thing is one surface that reacts to focus, rather than a
        // bordered textarea with controls parked underneath it.
        "group/composer relative flex flex-col gap-1 border bg-card p-2 shadow-sm transition-[box-shadow,border-color] duration-200",
        "focus-within:border-ring/60 focus-within:shadow-md",
        // The measure lives here rather than on each caller. Left to the
        // callers it was forgotten in the document panel, so the box ran the
        // full width of the panel while the answers above it sat in a column —
        // and on a maximised window that reads as a layout bug, because it is
        // one. Owning it here means a new surface cannot repeat the mistake.
        CHAT_COLUMN,
        className,
      )}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        // The ceiling is set from the same constant the resize effect clamps to,
        // rather than repeated as a utility class — written twice, the scroll
        // threshold and the visible height drift apart and the box ends up
        // either clipping early or growing past its own limit.
        style={{ maxHeight: MAX_HEIGHT }}
        // `field-sizing-content` is deliberately absent — see the note above.
        className="w-full border-none focus-visible:ring-0 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
      />

      <div className="flex items-center gap-1">

        <div className="ml-auto flex items-center gap-2">
        <ProviderPicker
          value={provider}
          onChange={onProviderChange}
          disabled={disabled}
        />
          {isStreaming && onStop ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStop}
              aria-label="Stop generating"
              className="size-8"
            >
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <motion.div
              // A small, quick swell as the button becomes usable. It is the
              // only affordance saying "this is ready to send now", and it
              // reads at a glance where a colour change alone does not.
              animate={{ scale: canSend ? 1 : 0.92 }}
              transition={fastTransition}
            >
              <Button
                type="submit"
                size="icon"
                disabled={!canSend}
                aria-label="Send"
                className="size-8 transition-opacity disabled:opacity-40"
              >
                <ArrowUp className="size-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </form>
  );
}
