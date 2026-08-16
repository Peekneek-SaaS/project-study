"use client";

import { useRef } from "react";

import {
  joinNote,
  noteBody,
  noteTitleLine,
} from "@/features/sticky-notes/lib/note-content";
import type { NoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
      <Input
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
          "shrink-0 truncate border-none px-3 font-semibold outline-none placeholder:font-normal placeholder:opacity-50",
          // `focus-visible:`, not `focus:` — see the textarea below.
          "focus-visible:border-transparent focus-visible:ring-0",
          // A read-only card is something to click, not something to select
          // into — without this a double-click highlights a word on its way to
          // opening the editor.
          readOnly && "cursor-pointer select-none",
        )}
      />

      <Textarea
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
          "min-h-0 flex-1 resize-none border-none px-3 pb-3 outline-none",
          "placeholder:opacity-50",
          /*
            `focus-visible:`, matching the variant the ring is actually written
            under. `Input` and `Textarea` both carry
            `focus-visible:border-ring focus-visible:ring-2`, so a `focus:`
            override is not competing with that rule at all — it is a different
            selector that happens to look like the right one, which is why the
            ring survived being "turned off".

            Worth knowing it applies on a plain click too: browsers treat text
            fields as always matching `:focus-visible`, so this is not only
            about keyboard focus. On a note that is the whole point — the card
            *is* the field, and a ring drawn inside its own edge reads as
            damage rather than as focus. The caret is the indicator instead,
            and the card keeps its own ring for arrowing around the grid.
          */
          "focus-visible:border-transparent focus-visible:ring-0",
          readOnly && "cursor-pointer select-none",
          appearance.showGrid && "note-ruled",
        )}
      />
    </div>
  );
}
