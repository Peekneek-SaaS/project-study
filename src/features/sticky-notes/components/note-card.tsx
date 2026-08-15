"use client";

import { useEffect, useRef, useState } from "react";

import { NoteEditor } from "@/features/sticky-notes/components/note-editor";
import { NoteModal } from "@/features/sticky-notes/components/note-modal";
import { NoteToolbar } from "@/features/sticky-notes/components/note-toolbar";
import { useNoteMutations } from "@/features/sticky-notes/hooks/use-note-mutations";
import {
  noteAppearanceStyle,
  toNoteAppearance,
} from "@/features/sticky-notes/lib/note-appearance";
import type { StickyNote } from "@/features/sticky-notes/types";
import { cn } from "@/lib/utils";

/**
 * How long a click waits to find out whether it was half of a double one.
 *
 * The two gestures mean different things here, and the browser reports the
 * first click of a pair before it knows a second is coming — so opening the
 * modal on the first one would open it every time the user meant to edit in
 * place. Roughly the platform's own double-click threshold.
 */
const DOUBLE_CLICK_MS = 250;

/**
 * One sticky note on the wall.
 *
 * Read-only until asked otherwise, which is what lets a click mean something:
 * once to open the note properly, twice to write on it where it sits. Fixed
 * size either way — that is the point of a wall of them, and it is why the body
 * scrolls rather than the card growing.
 *
 * Text is held here rather than driven by the row, and the modal is handed the
 * same state: one note cannot disagree with itself while both views are open,
 * and a refetch of the list cannot reach in and replace a half-written
 * sentence.
 */
export function NoteCard({
  note,
  isFlashing = false,
}: {
  note: StickyNote;
  /** Briefly ringed after being arrived at from search — see `NotesGrid`. */
  isFlashing?: boolean;
}) {
  const { saveContent, patchAppearance, removeNote, isRemoving } =
    useNoteMutations(note.id);

  // Seeded once. The row's `content` is not read again for the life of this
  // card, deliberately — see above.
  const [content, setContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const articleRef = useRef<HTMLElement>(null);
  const clickTimer = useRef<number | null>(null);

  const appearance = toNoteAppearance(note);

  const handleChange = (value: string) => {
    setContent(value);
    saveContent(value);
  };

  const cancelPendingClick = () => {
    if (clickTimer.current === null) return;
    window.clearTimeout(clickTimer.current);
    clickTimer.current = null;
  };

  useEffect(() => cancelPendingClick, []);

  const handleClick = () => {
    // Already writing here: a click is a click into the text, not a request to
    // open anything.
    if (isEditing) return;
    if (clickTimer.current !== null) return;

    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      setIsOpen(true);
    }, DOUBLE_CLICK_MS);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    cancelPendingClick();
    if (isEditing) return;

    setIsEditing(true);

    // Focused on the next frame, once the fields have lost `readOnly` —
    // and on the one that was actually double-clicked, so the caret lands where
    // the user was pointing rather than always in the body.
    const target = event.target as HTMLElement | null;
    const field =
      target?.closest<HTMLElement>("[data-note-field]") ??
      articleRef.current?.querySelector<HTMLElement>(
        '[data-note-field="body"]',
      );

    window.requestAnimationFrame(() => field?.focus());
  };

  return (
    <>
      <article
        ref={articleRef}
        data-note-id={note.id}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        // Editing ends when attention leaves the note — clicking the page, or
        // tabbing out. `relatedTarget` inside the card is a move between the
        // title and the body, which is still editing.
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          setIsEditing(false);
        }}
        // Every per-note value arrives as a custom property, so the stylesheet
        // stays free of anything specific to this note.
        style={{
          ...noteAppearanceStyle(appearance),
          borderColor: "var(--note-edge)",
        }}
        className={cn(
          "flex h-56 flex-col overflow-hidden rounded-lg border shadow-sm transition-opacity",
          isRemoving && "pointer-events-none opacity-50",
          isFlashing && "note-flash",
        )}
      >
        <div
          className="flex shrink-0 items-center justify-end gap-1 px-1.5 py-1"
          style={{ background: "var(--note-bg)" }}
        >
          <NoteToolbar
            appearance={appearance}
            onAppearanceChange={(patch) => void patchAppearance(patch)}
            onDelete={() => void removeNote()}
          />
        </div>

        <NoteEditor
          content={content}
          onChange={handleChange}
          appearance={appearance}
          readOnly={!isEditing}
        />
      </article>

      <NoteModal
        open={isOpen}
        onOpenChange={setIsOpen}
        content={content}
        onChange={handleChange}
        appearance={appearance}
        onAppearanceChange={(patch) => void patchAppearance(patch)}
        onDelete={() => void removeNote()}
      />
    </>
  );
}
