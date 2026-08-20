"use client";

import { useCallback, useEffect, useImperativeHandle, useRef } from "react";

import {
  noteBodyHtml,
  normaliseHtml,
  sanitiseNoteHtml,
} from "@/features/sticky-notes/lib/note-html";
import { cn } from "@/lib/utils";

/**
 * The note's body, written the way it will be read.
 *
 * A `contentEditable` region rather than a textarea, which is the whole of what
 * "bold should look bold" requires: the browser applies the formatting to the
 * words themselves, and it brings three behaviours with it that would each be a
 * project on their own —
 *
 *   - Return inside a list opens the next item, and Return on an empty item
 *     ends the list. Native, both of them, and exactly what was asked for.
 *   - Backspace at the start of an item unwraps it back to a paragraph.
 *   - Undo covers formatting as well as typing, because the browser's own undo
 *     stack is the one being used.
 *
 * The commands go through `document.execCommand`. It carries a deprecation
 * notice and no replacement — the Editing API meant to succeed it was never
 * finished, browsers all still implement it, and every editor that does not
 * ship its own document model is built on it. Reaching for a framework instead
 * would mean a schema, a serialiser and four packages to get the behaviour this
 * component gets from the platform in a hundred lines.
 *
 * Uncontrolled on purpose, and this is the part that is easy to get wrong. If
 * the parent's string were written back into the DOM on every render, the
 * browser would rebuild the nodes under the caret mid-word and the caret would
 * jump to the start of the note on every keystroke. So the value is pushed in
 * only when it differs from what this component last emitted — which is true
 * when the note is first opened, and false for everything the user types.
 */

export interface NoteRichTextHandle {
  /**
   * Remember where the caret is, before something steals the focus.
   *
   * The link dialog is the reason this exists: opening it moves focus into its
   * input, and a `contentEditable` that has lost focus has lost its selection —
   * so by the time an address has been typed there is nothing left to link.
   * Captured on the way out, restored on the way back in.
   */
  captureSelection: () => void;
  /** Bold, italic or underline over the selection. */
  format: (command: "bold" | "italic" | "underline") => void;
  /** Turn the selected lines into a list, or back out of one. */
  list: (kind: "bullet" | "ordered") => void;
  /** Make the selection a link to `href`. */
  link: (href: string) => void;
  /** Drop the link the selection sits in, keeping the words. */
  unlink: () => void;
  /** The words currently selected, for the link dialog to show. */
  selectedText: () => string;
  /** Whether anything is actually selected, as opposed to a caret sitting somewhere. */
  hasSelection: () => boolean;
  /**
   * Set the size of the selected run, in px.
   *
   * The one command that has no `execCommand` of its own worth using: the
   * built-in `fontSize` speaks in the seven sizes of 1995 HTML and writes
   * `<font>` tags. It is still the way *in* — nothing else marks an arbitrary
   * selection, across element boundaries, as reliably — so it is used as a
   * marker and the tags it leaves are immediately swapped for spans carrying a
   * real pixel size.
   */
  setFontSize: (px: number) => void;
  /**
   * Mark the selection, or clear the mark on it.
   *
   * The one command that wants CSS output rather than tags — there is no
   * element for "highlighted", only a background — so `styleWithCSS` is turned
   * on for the length of the call and off again straight after. Left on, the
   * next Bold would write `<span style="font-weight: bold">`, which the
   * sanitiser strips: the note would look right until it was reopened.
   */
  setHighlight: (hex: string | null) => void;
  /**
   * The size of the text at the caret, as the browser actually renders it.
   *
   * Read rather than remembered, for the reason the bold state is: what size
   * the text is depends on which run the caret is in, and only the document
   * knows that.
   */
  currentFontSize: () => number | null;
  /** Whether the caret is inside a link, and what it points at. */
  currentLink: () => string | null;
  focus: () => void;
}

export function NoteRichText({
  ref,
  body,
  onChange,
  readOnly = false,
  placeholder,
  onSelectionChange,
  className,
}: {
  ref?: React.Ref<NoteRichTextHandle>;
  /** The stored body — HTML from this editor, or plain text from before it. */
  body: string;
  onChange: (bodyHtml: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Fires whenever the caret moves, so a toolbar can light its buttons. */
  onSelectionChange?: () => void;
  className?: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);

  /**
   * The HTML this component last handed out or last wrote in.
   *
   * The gate for the effect below: anything equal to this is our own edit
   * coming back round through the parent, and writing it in again would be the
   * caret-destroying round trip described above.
   */
  const lastHtml = useRef<string | null>(null);

  /** The selection as it was before the focus went somewhere else. */
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const incoming = noteBodyHtml(body);
    if (incoming === lastHtml.current) return;

    lastHtml.current = incoming;
    field.innerHTML = incoming;
  }, [body]);

  const emit = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;

    // Sanitised on the way out as well as on the way in. This is the path a
    // paste arrives by, and a paste is the one moment a note can be handed
    // markup nothing in this app wrote.
    const html = sanitiseNoteHtml(field.innerHTML);

    // A field emptied down to the browser's leftovers is an empty field. Chrome
    // leaves a bare `<br>` behind when the last character goes, and without
    // this every emptied note would be stored as one and never show its
    // placeholder again.
    const isEmpty =
      html === "<br>" || html.replace(/<br\s*\/?>/g, "").trim() === "";
    const next = isEmpty ? "" : normaliseHtml(html);

    if (next === lastHtml.current) return;
    lastHtml.current = next;
    onChange(next);
  }, [onChange]);

  const run = useCallback(
    (command: string, value?: string) => {
      const field = fieldRef.current;
      if (!field || readOnly) return;

      field.focus();
      document.execCommand(command, false, value);
      emit();
    },
    [emit, readOnly],
  );

  useEffect(() => {
    // Tags, not inline styles: `styleWithCSS` on gives `<span style="font-weight:
    // bold">`, which the sanitiser strips on the way to the database — the note
    // would look right until it was reopened. Off, the browser writes `<b>`.
    // Set once, globally, because the flag is a property of the document.
    document.execCommand("styleWithCSS", false, "false");
  }, []);

  /** Puts a captured selection back, so a command lands where the user left it. */
  const restoreSelection = useCallback(() => {
    const range = savedRange.current;
    const selection = window.getSelection();
    if (!range || !selection) return;

    fieldRef.current?.focus();
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      captureSelection: () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!fieldRef.current?.contains(range.commonAncestorContainer)) return;

        // Cloned, because the live range keeps moving with the selection — by
        // the time it is read back it would describe wherever the caret ended
        // up rather than where it was.
        savedRange.current = range.cloneRange();
      },
      format: (command) => run(command),
      list: (kind) =>
        run(kind === "bullet" ? "insertUnorderedList" : "insertOrderedList"),
      link: (href) => {
        restoreSelection();
        run("createLink", href);
      },
      unlink: () => {
        restoreSelection();
        run("unlink");
      },
      selectedText: () => window.getSelection()?.toString() ?? "",
      hasSelection: () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return false;
        const range = selection.getRangeAt(0);
        return (
          fieldRef.current?.contains(range.commonAncestorContainer) ?? false
        );
      },
      setFontSize: (px) => {
        const field = fieldRef.current;
        if (!field || readOnly) return;

        field.focus();

        /*
          `7` is not a size, it is a tag to grep for.

          `execCommand("fontSize")` takes 1–7 and writes `<font size="n">`
          around the selection, splitting and re-wrapping nodes as needed —
          which is the hard part, and the reason this is worth borrowing. The
          largest is used because it is the least likely to already be in the
          document, so the sweep below cannot pick up someone else's markup.
        */
        document.execCommand("fontSize", false, "7");

        for (const marker of Array.from(
          field.querySelectorAll('font[size="7"]'),
        )) {
          const span = document.createElement("span");
          span.style.fontSize = `${px}px`;
          while (marker.firstChild) span.appendChild(marker.firstChild);
          marker.replaceWith(span);

          // Left selected, so the size can be stepped again without the words
          // having to be picked out a second time.
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        emit();
      },
      setHighlight: (hex) => {
        const field = fieldRef.current;
        if (!field || readOnly) return;

        field.focus();
        document.execCommand("styleWithCSS", false, "true");

        // `hiliteColor` is the standard name and `backColor` is what some
        // engines answer to; the first returns false when it did nothing, which
        // is the cue to try the other rather than a reason to give up.
        const colour = hex ?? "transparent";
        if (!document.execCommand("hiliteColor", false, colour)) {
          document.execCommand("backColor", false, colour);
        }

        document.execCommand("styleWithCSS", false, "false");
        emit();
      },
      currentFontSize: () => {
        const selection = window.getSelection();
        const node = selection?.anchorNode;
        if (!node || !fieldRef.current?.contains(node)) return null;

        const element =
          node.nodeType === Node.ELEMENT_NODE
            ? (node as Element)
            : node.parentElement;
        if (!element) return null;

        const size = Number.parseFloat(
          window.getComputedStyle(element).fontSize,
        );
        return Number.isFinite(size) ? Math.round(size) : null;
      },
      currentLink: () => {
        const selection = window.getSelection();
        const node = selection?.anchorNode;
        if (!node || !fieldRef.current?.contains(node)) return null;

        const element =
          node.nodeType === Node.ELEMENT_NODE
            ? (node as Element)
            : node.parentElement;
        return element?.closest("a")?.getAttribute("href") ?? null;
      },
      focus: () => fieldRef.current?.focus(),
    }),
    [emit, readOnly, restoreSelection, run],
  );

  /**
   * The caret moved — but only tell the toolbar when it moved in *here*.
   *
   * `selectionchange` is a document-level event: it fires for every field on
   * the page, including the note's title input and anything in a dialog over
   * the top. Filtering by containment is what stops the toolbar lighting up
   * for a selection that has nothing to do with the note.
   */
  useEffect(() => {
    if (!onSelectionChange) return;

    const handle = () => {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      if (node && fieldRef.current?.contains(node)) onSelectionChange();
    };

    document.addEventListener("selectionchange", handle);
    return () => document.removeEventListener("selectionchange", handle);
  }, [onSelectionChange]);

  return (
    <div
      ref={fieldRef}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      aria-label="Note text"
      aria-readonly={readOnly || undefined}
      data-note-field="body"
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={emit}
      // A paste carries the source's markup with it — fonts, colours, whole
      // layouts. Taking the plain text and letting the browser insert it means
      // a paste from a web page arrives as words rather than as a fragment of
      // that page, and the note keeps its own type.
      onPaste={(event) => {
        if (readOnly) return;
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      /*
        Links open on ⌘/ctrl-click, and only then.

        A plain click has to keep meaning "put the caret here" — a link you
        cannot get the cursor into is a link you cannot edit the words of. The
        modifier is the same one the whole web uses for "open this elsewhere",
        so it needs no explaining, and `noopener` keeps the opened page from
        reaching back into this one.
      */
      onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey) return;

        const anchor = (event.target as HTMLElement).closest("a");
        const href = anchor?.getAttribute("href");
        if (!href) return;

        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      style={{
        /*
          The note's own colour, as the textarea this replaced had it. Without
          it the body was the page's background and only the title strip was
          amber — a card in two colours, which is the one thing a sticky note
          is not.

          `backgroundColor`, never the `background` shorthand, and this is what
          the ruled lines hang on: the shorthand resets every background
          property it does not mention, `background-image` included — so an
          inline `background` here silently wiped out the repeating gradient
          `.note-ruled` paints, and the grid-lines switch turned a class on that
          could never draw anything. The longhand leaves the image alone.
        */
        backgroundColor: "var(--note-bg)",
        color: "var(--note-ink)",
        fontFamily: "var(--note-font-family)",
        fontSize: "var(--note-font-size)",
        lineHeight: "var(--note-line-height)",
      }}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-3 pb-3 outline-none",
        /*
          `whitespace-pre-wrap` is what lets the spaces be ordinary spaces.

          It is the other half of the `\u00A0` scrubbing in `sanitiseNoteHtml`:
          the browser only reaches for a non-breaking space because the default
          whitespace rules would eat a doubled or trailing one. Told to preserve
          them, it has nothing to work around, and the two spaces someone typed
          between sentences are still there when the note is read back.
        */
        "whitespace-pre-wrap",
        // The lists the toolbar makes, and the link colour asked for. Written
        // here rather than in the stylesheet because they only apply to note
        // bodies, and `[&_…]` keeps them scoped to this element's subtree.
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        // A sized run is a `span` with an inline `font-size`; nothing here may
        // override it, which is why no `text-*` utility is applied to the
        // field's descendants.
        "[&_a]:cursor-pointer [&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-blue-800",
        // `:empty` alone is not enough — a field the browser has left a `<br>`
        // in is not empty, and that is the state an emptied note is in.
        "empty:before:content-[attr(data-placeholder)] empty:before:opacity-50",
        readOnly && "cursor-pointer select-none",
        className,
      )}
    />
  );
}
