"use client";

import { ArrowUp, FileText, Square } from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  ChatMentionMenu,
  type MentionFile,
  useMentionFiles,
} from "@/features/chat/components/chat-mention-menu";
import { ProviderPicker } from "@/features/chat/components/provider-picker";
import {
  applyMention,
  findActiveMention,
  splitMentions,
  type ActiveMention,
} from "@/features/chat/lib/mention";
import { CHAT_COLUMN } from "@/features/chat/types";
import { fastTransition } from "@/lib/motion";
import type { AiProvider } from "@/lib/ai/types";
import { useComposerInsertStore } from "@/lib/stores/composer-insert-store";
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

/**
 * How much room the composer is allowed to take.
 *
 * `default` is the composer as the middle of the landing page, where it is the
 * only thing on screen and the question being written is the whole task.
 * `compact` is the composer *under a conversation* — a document's panel, an
 * open chat — where the transcript is what the reader is there for and every
 * row the box takes is a row of the answer they lose. Same control, less of it:
 * a lower ceiling before it scrolls, tighter padding, smaller buttons.
 */
export type ComposerSize = "default" | "compact";

/** How tall the box may grow before it starts scrolling instead, in px. */
const MAX_HEIGHT: Record<ComposerSize, number> = {
  default: 220,
  compact: 120,
};

/**
 * Everything the text field and the layer behind it must agree on.
 *
 * A textarea cannot colour part of its own value, so a chosen file is marked by
 * a second copy of the question sitting exactly underneath it: invisible text,
 * with a background painted behind the words that name a file. Which only works
 * while the two lay their text out identically — one different pixel of padding
 * or a line-height off by a hair and the marks slide away from the words they
 * belong to.
 *
 * So the metrics are written once, here, and handed to both. `md:text-xs` is
 * part of that: the base textarea changes size at that breakpoint, and a layer
 * that did not would be misaligned on every desktop.
 *
 * Per size for the same reason they exist at all: the compact box sheds a row
 * of padding, and it has to shed it from both layers at once.
 */
const FIELD_METRICS: Record<ComposerSize, string> = {
  default: "px-2 py-1.5 text-sm leading-relaxed md:text-xs/relaxed",
  compact: "px-2 py-1 text-sm leading-relaxed md:text-xs/relaxed",
};

export function ChatComposer({
  onSubmit,
  onStop,
  isStreaming = false,
  provider,
  onProviderChange,
  attachment,
  placeholder = "Ask anything about your documents…",
  autoFocus = false,
  disabled = false,
  mentions = true,
  size = "default",
  className,
}: {
  /** Given the question, trimmed and known non-empty. */
  onSubmit: (question: string) => void;
  /** Absent when there is nothing to stop — the button is send-only then. */
  onStop?: () => void;
  isStreaming?: boolean;
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  /**
   * What this composer is asking *about*, shown across the top of the box.
   *
   * A slot inside the composer rather than something the caller stacks above
   * it, because "attached" has to survive every width: rendered as a sibling it
   * would be a second box to keep aligned with this one, and the two would
   * drift the first time the measure or the padding changed. Inside, it shares
   * the border, the background and the focus ring by construction.
   *
   * Absent for the universal chat, which is asking about everything and has
   * nothing to name.
   */
  attachment?: React.ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * Whether typing `@` offers the user's files.
   *
   * On everywhere the question could be about any document, and off in a
   * document's own chat: that conversation can only search the one document it
   * belongs to, so a menu of the others would be offering references it is
   * going to refuse.
   */
  mentions?: boolean;
  /** How much vertical room this composer may take — see `ComposerSize`. */
  size?: ComposerSize;
  className?: string;
}) {
  const isCompact = size === "compact";
  const maxHeight = MAX_HEIGHT[size];
  const fieldMetrics = FIELD_METRICS[size];

  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** The layer the marks are drawn on — see `FIELD_METRICS`. */
  const highlightRef = useRef<HTMLDivElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  /**
   * The `@…` being typed, if one is.
   *
   * Read back off the textarea rather than derived from `value` alone, because
   * where the caret is decides as much as what the text says: the same question
   * has a mention open or not depending on whether the cursor is sitting in the
   * token or somewhere else in the line.
   */
  const [mention, setMention] = useState<ActiveMention | null>(null);
  /**
   * The token the user has already dismissed, by its position.
   *
   * Backspace and Escape close this menu, and without remembering *which*
   * token was closed the very next keystroke would reopen it — the caret is
   * still inside an `@word`, which is the condition that opens it. Kept as the
   * `@`'s index so that starting a new mention elsewhere in the line opens
   * normally.
   */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * The names taken from the menu, which are the ones drawn as references.
   *
   * Names and not ids, because what is in the box is text: the question is one
   * string, the model reads it as one string, and the highlight has to be
   * derived from what is actually written rather than from a list of
   * attachments kept alongside it that a single backspace could put out of
   * step. See `splitMentions`.
   */
  const [mentioned, setMentioned] = useState<string[]>([]);

  const isMentioning = mentions && mention !== null;
  const { files, isLoading: isLoadingFiles } = useMentionFiles(
    mention?.query ?? "",
    isMentioning,
  );

  // Which row Enter would take. Held by id rather than by index so that the
  // list narrowing under the user does not silently move the highlight onto
  // whatever has taken that row's place; when the id goes, the top row wins.
  const activeFile =
    files.find((file) => file.id === activeId) ?? files[0] ?? null;

  const isMenuOpen = isMentioning && (isLoadingFiles || files.length > 0);

  /**
   * Reads the caret and decides whether a mention is open.
   *
   * Called from every event that can move the caret — typing, clicking, arrow
   * keys — rather than from a `useEffect` on `value`, because an effect cannot
   * see a selection change that leaves the text alone.
   */
  const refreshMention = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !mentions) return;

    const next = findActiveMention(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length,
    );

    // A token the user has already closed stays closed. Anything else — no
    // token at all, or a new one started elsewhere in the line — clears the
    // dismissal, because the reason for it has gone.
    if (next !== null && next.start === dismissedAt) {
      setMention(null);
      return;
    }

    setMention(next);
    setDismissedAt(null);
  }, [dismissedAt, mentions]);

  const closeMention = useCallback(() => {
    setDismissedAt(mention?.start ?? null);
    setMention(null);
  }, [mention]);

  /**
   * Puts a file's name where the token was.
   *
   * The reference is the name in the text and nothing else — no hidden id, no
   * parallel list of attachments. The model is handed a catalogue of the user's
   * documents with every question and narrows its search to the one named, so
   * the plain sentence is the whole protocol, and a question that survives
   * being edited by hand is worth more than a token that does not.
   */
  const chooseFile = useCallback(
    (file: MentionFile) => {
      const textarea = textareaRef.current;
      if (!textarea || !mention) return;

      const next = applyMention(textarea.value, mention, file.name);

      setValue(next.value);
      setMention(null);
      setDismissedAt(null);
      setMentioned((names) =>
        names.includes(file.name) ? names : [...names, file.name],
      );

      // After the state lands, so the caret is placed in the text that is
      // actually on screen rather than in the one being replaced.
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(next.caret, next.caret);
      });
    },
    [mention],
  );

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
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [maxHeight, value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  /**
   * Collects text left for the composer by something else on the page —
   * "Reply" on a selected passage, today.
   *
   * Appended rather than assigned: a half-written question is not something to
   * throw away because a quotation arrived, and the likely next action is
   * typing *around* what was just pasted.
   *
   * Subscribed to `pending` and read through `take`, which clears as it reads,
   * so React's development double-invoke cannot paste the same passage twice.
   */
  useEffect(
    () =>
      // Subscribed to, rather than selected and reacted to with a second
      // effect. Reading `pending` as state and setting `value` from it would be
      // a synchronous setState inside an effect — a cascading render, and one
      // the React Compiler rightly refuses. A subscription is what an effect is
      // actually for: the update happens in the callback, when the store
      // changes, not while the effect body runs.
      useComposerInsertStore.subscribe((state, previous) => {
        if (state.pending === null || state.pending === previous.pending)
          return;

        const text = useComposerInsertStore.getState().take();
        if (!text) return;

        setValue((current) =>
          current.trim() ? `${current.trimEnd()}\n\n${text}` : text,
        );
        textareaRef.current?.focus();
      }),
    [],
  );

  const submit = useCallback(() => {
    const question = value.trim();
    if (!question || disabled) return;

    onSubmit(question);
    setValue("");
    // The references went with the question. Keeping them would have the next
    // one highlighting a name that happened to be typed again by hand.
    setMentioned([]);
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
      /*
        The menu gets the keyboard first while it is open, and only the keys it
        actually uses. Everything else falls through to the textarea, which is
        the point: this is a list that opens *while* someone is typing a
        sentence, so typing has to keep working.
      */
      if (isMenuOpen) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (files.length === 0) return;

          const current = files.findIndex((file) => file.id === activeFile?.id);
          const step = event.key === "ArrowDown" ? 1 : -1;
          // Wraps, so holding one arrow gets you round the list rather than
          // stopping at an end nobody can see the edge of.
          const next = (current + step + files.length) % files.length;
          setActiveId(files[next].id);
          return;
        }

        // Tab as well as Enter: this is a completion, and completions are
        // accepted with Tab everywhere else a person types.
        if (
          (event.key === "Enter" || event.key === "Tab") &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing &&
          activeFile
        ) {
          event.preventDefault();
          chooseFile(activeFile);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeMention();
          return;
        }
      }

      /*
        Deleting closes it, as asked — and not only when the menu is open, so
        that rubbing out a token does not leave it reopening on the way past.
        No `preventDefault`: the keystroke is the user editing their sentence,
        and it still has to delete the character.
      */
      if (event.key === "Backspace" || event.key === "Delete") {
        closeMention();
        return;
      }

      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.nativeEvent.isComposing) return;

      event.preventDefault();
      submit();
    },
    [activeFile, chooseFile, closeMention, files, isMenuOpen, submit],
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
        "group/composer relative flex border bg-card shadow-sm transition-[box-shadow,border-color] duration-200",
        "focus-within:border-ring/60 focus-within:shadow-md dark:bg-muted",
        /*
          Both arrangements are columns; what differs is how many rows the parts
          take. Default gives each of the three its own — label, question,
          controls. Compact folds the last two together, so the question and the
          buttons share a line and only the label is above them.

          Which is the only way to have all three where they are wanted. In one
          row the three are siblings, so the field is the middle sibling by
          construction: the name holds the left end, the buttons hold the right,
          and the question can start only where the name stops — an input adrift
          in the middle of the box the longer the document is called.
        */
        isCompact ? "flex-col gap-0.5 px-2 py-1.5" : "flex-col gap-1 p-2",
        // The measure lives here rather than on each caller. Left to the
        // callers it was forgotten in the document panel, so the box ran the
        // full width of the panel while the answers above it sat in a column —
        // and on a maximised window that reads as a layout bug, because it is
        // one. Owning it here means a new surface cannot repeat the mistake.
        CHAT_COLUMN,
        className,
      )}
    >
      {/*
        Inside the border, so it reads as a label on the box rather than a
        separate control floating over it — and on its own line at the top of
        it, which is what leaves the left edge to the question. A long name
        truncates rather than taking the row from the field.
      */}
      {attachment && (
        <div
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
            isCompact ? "px-2 pb-0.5" : "px-2 pb-1.5",
          )}
        >
          {attachment}
        </div>
      )}

      {isMenuOpen && (
        <ChatMentionMenu
          files={files}
          isLoading={isLoadingFiles}
          activeId={activeFile?.id ?? null}
          onSelect={chooseFile}
          onHighlight={(file) => setActiveId(file.id)}
        />
      )}

      {/*
        The question and the buttons, on one line in compact and on two
        otherwise.

        `contents` is what makes the second case cost nothing: the wrapper stops
        generating a box of its own and its children become the form's own flex
        items again, exactly as they were before this div existed. So the
        stacked layout is untouched and the row is one class rather than two
        copies of the parts.
      */}
      <div className={cn(isCompact ? "flex items-end gap-1" : "contents")}>
        {/*
        The text and its highlight, stacked. `relative` is what the layer below
        is positioned against, and the wrapper takes its size from the textarea
        — which is the one that actually measures the content.
      */}
        <div className={cn("relative", isCompact && "min-w-0 flex-1")}>
          {/*
          The question as it is actually read, once a file has been named.

          Note which layer is which. While there are no references this is not
          mounted at all and the textarea shows its own text; the moment one is
          chosen, this takes over the drawing and the textarea goes transparent
          on top of it. That swap is what lets a mention be dark words on solid
          yellow: a textarea cannot colour part of its own value, so the words
          over a mark can only be black if they are not the textarea's words.

          Seamless because the two share `FIELD_METRICS` to the pixel — the same
          reason the marks line up with the text in the first place.

          `aria-hidden` and `select-none` because this is a duplicate: the real
          value, the one a screen reader reads and the one a selection has to
          come from, is still the textarea's.

          It scrolls with the textarea rather than clipping: the box scrolls
          once a question runs past its ceiling, and a layer that stayed put
          would leave the marks behind a few lines up.
        */}
          {mentioned.length > 0 && (
            <div
              ref={highlightRef}
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 overflow-hidden select-none",
                "whitespace-pre-wrap wrap-break-word",
                fieldMetrics,
              )}
            >
              {splitMentions(value, mentioned).map((segment, index) =>
                segment.isMention ? (
                  <mark
                    key={index}
                    /*
                    Background and colour only — no padding, no margin, no
                    border. Anything that took up space would push the text of
                    this layer out of step with the caret and the selection
                    above it, and a mention would drift further from its own
                    mark with every one in the line. `box-decoration-break` is
                    what keeps a mention that wraps looking like one mark rather
                    than two.

                    Black on yellow in both themes. The mark is a solid,
                    light-coloured surface whatever the page is doing around it,
                    so it takes its own foreground rather than the theme's —
                    white on yellow, which is what dark mode would otherwise
                    give it, is the one combination here that cannot be read.
                  */
                    className="rounded-[3px] bg-blue-200 text-black [box-decoration-break:clone] dark:bg-blue-300"
                  >
                    {/*
                    The `@` wearing a file icon, rather than an icon put in
                    front of it.

                    Nothing on this layer may take up space that the textarea
                    above does not: an icon inserted into the flow would push
                    every word after it to the right, and since the caret and
                    the selection come from the textarea — which has no icon —
                    they would sit further from the words with each mention in
                    the line. So the sigil keeps its own box and its own advance
                    width, goes transparent, and the icon is laid over it. The
                    text moves not at all, and the token reads as a file rather
                    than as an address.
                  */}
                    <span className="relative text-transparent">
                      {segment.text.slice(0, 1)}
                      <FileText
                        aria-hidden
                        // Centred on the `@` and a touch wider than it, so it
                        // reads as a glyph rather than a speck. Black-stroked
                        // rather than the drive's pale outline: at this size, on
                        // yellow, the outline is what carries the shape.
                        className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 fill-orange-400 stroke-orange-200"
                      />
                    </span>
                    {segment.text.slice(1)}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
              {/* A trailing newline has no height of its own, so the layer would
                come up short of the textarea's scroll height and the last line
                would sit a row off. */}
              {"\n"}
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              refreshMention();
            }}
            // Every other way the caret moves: clicking into the middle of a
            // sentence, the arrow keys, a selection. `onChange` alone would leave
            // the menu open over a token the cursor had walked out of.
            onSelect={refreshMention}
            onBlur={() => setMention(null)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            // The ceiling is set from the same constant the resize effect clamps to,
            // rather than repeated as a utility class — written twice, the scroll
            // threshold and the visible height drift apart and the box ends up
            // either clipping early or growing past its own limit.
            style={{ maxHeight }}
            // Kept in step with the layer behind it, which cannot scroll itself.
            onScroll={(event) => {
              if (highlightRef.current) {
                highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            // `field-sizing-content` is deliberately absent — see the note above.
            //
            // The background stays transparent so the layer underneath shows
            // through, and `relative` keeps this above it — which is what makes
            // the caret, the selection and every pointer target the real field.
            className={cn(
              "relative w-full resize-none border-none bg-transparent outline-none focus-visible:ring-0",
              "placeholder:text-muted-foreground/70 disabled:opacity-60 dark:bg-transparent",
              fieldMetrics,
              /*
              Once the layer below is drawing the question, this stops drawing
              it — two copies of the same words a pixel apart is what "not
              properly seen" looks like.

              Which leaves two things to hand back, both of which follow
              `color` and would have gone transparent with the text. The caret
              is named explicitly, and the selection is given a translucent wash
              rather than the solid default, so selecting a sentence still shows
              the sentence rather than a bar over it.
            */
              mentioned.length > 0 &&
                "text-transparent caret-foreground selection:bg-primary/25 selection:text-transparent",
            )}
          />
        </div>

        {/*
          The right end of whichever line they are on. `ml-auto` is what does it
          when they have the line to themselves; beside the field, the field's
          `flex-1` has already taken the slack and this simply follows it.
        */}
        <div
          className={cn(
            "ml-auto flex items-center gap-2",
            isCompact && "shrink-0",
          )}
        >
          <ProviderPicker
            value={provider}
            onChange={onProviderChange}
            disabled={disabled}
            // Important, deliberately: the picker sets its own `h-8`, and two
            // height utilities of the same family on one element are settled by
            // stylesheet order rather than by which was written last.
            className={cn(isCompact && "h-7!")}
          />
          {isStreaming && onStop ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStop}
              aria-label="Stop generating"
              className={cn(isCompact ? "size-7 rounded-full" : "size-8")}
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
                className={cn(
                  "transition-opacity disabled:opacity-40",
                  // Round, in the row: the pill's own shape repeated at the end
                  // of it, which is what a square button in a stadium is not.
                  isCompact ? "size-7 rounded-full" : "size-8",
                )}
              >
                <ArrowUp className={cn(isCompact ? "size-3.5" : "size-4")} />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </form>
  );
}
