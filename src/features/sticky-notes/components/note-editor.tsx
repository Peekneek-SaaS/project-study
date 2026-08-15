"use client";

import { useRef } from "react";

import {
  joinNote,
  noteBody,
  noteTitleLine,
} from "@/features/sticky-notes/lib/note-content";
import type { NoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * A note's text, in the two fields it is written in.
 *
 * One string in the database, two fields here: a textarea cannot embolden part
 * of itself, so the first line — the note's name — gets its own input, and
 * `joinNote` puts them back together on every keystroke.
 *
 * Shared by the card and the modal so the note reads the same in both, and so
 * "bold first line" is defined once. `readOnly` is what separates them on the
 * grid: a card is not typed into until it has been asked for.
 */
export function NoteEditor({
  content,
  onChange,
  appearance,
  readOnly = false,
  className,
}: {
  content: string;
  onChange: (content: string) => void;
  appearance: NoteAppearance;
  readOnly?: boolean;
  className?: string;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const fieldStyle = {
    background: "var(--note-bg)",
    color: "var(--note-ink)",
    fontSize: "var(--note-font-size)",
    lineHeight: "var(--note-line-height)",
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <input
        value={noteTitleLine(content)}
        onChange={(event) =>
          onChange(joinNote(event.target.value, noteBody(content)))
        }
        onKeyDown={(event) => {
          // Enter would submit nothing and do nothing here; carrying on into
          // the note is what the key means on a sheet of paper.
          if (event.key !== "Enter") return;
          event.preventDefault();
          bodyRef.current?.focus();
        }}
        placeholder={readOnly ? "" : "Name this note…"}
        aria-label="Note name"
        spellCheck={false}
        readOnly={readOnly}
        data-note-field="title"
        style={fieldStyle}
        className={cn(
          "shrink-0 truncate px-3 font-semibold outline-none placeholder:font-normal placeholder:opacity-50",
          // A read-only card is something to click, not something to select
          // into — without this a double-click highlights a word on its way to
          // opening the editor.
          readOnly && "cursor-pointer select-none",
        )}
      />

      <textarea
        ref={bodyRef}
        value={noteBody(content)}
        onChange={(event) =>
          onChange(joinNote(noteTitleLine(content), event.target.value))
        }
        placeholder={readOnly ? "" : "Write something…"}
        aria-label="Note text"
        spellCheck={false}
        readOnly={readOnly}
        data-note-field="body"
        style={fieldStyle}
        className={cn(
          // `flex-1` with `min-h-0` is what keeps the card one height: the
          // textarea takes what is left and scrolls the rest, instead of the
          // content deciding how tall the note is.
          "min-h-0 flex-1 resize-none px-3 pb-3 outline-none",
          "placeholder:opacity-50",
          readOnly && "cursor-pointer select-none",
          appearance.showGrid && "note-ruled",
        )}
      />
    </div>
  );
}
