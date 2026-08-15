"use client";

import { useRef, useState } from "react";

import { NoteEditor } from "@/features/sticky-notes/components/note-editor";
import { NoteModal } from "@/features/sticky-notes/components/note-modal";
import { NoteToolbar } from "@/features/sticky-notes/components/note-toolbar";
import { useNoteMutations } from "@/features/sticky-notes/hooks/use-note-mutations";
import {
  noteAppearanceStyle,
  toNoteAppearance,
} from "@/features/sticky-notes/lib/note-appearance";
import type { StickyNote } from "@/features/sticky-notes/types";
import {
  ROW_ATTRIBUTE,
  type RowSelectModifiers,
  useRowInteraction,
} from "@/hooks/use-row-interaction";
import {
  selectHasSelection,
  selectIsRowSelected,
} from "@/lib/stores/create-selection-store";
import { useNoteSelectionStore } from "@/lib/stores/note-selection-store";
import { cn } from "@/lib/utils";

/**
 * One sticky note on the wall.
 *
 * Click selects, double-click opens — the same gestures as a row in the drive
 * or the boards table, and the reason this card no longer runs a timer to tell
 * one click from two. That timer existed because both gestures meant "open
 * something" and the browser reports the first click before it knows a second
 * is coming; now that a single click selects, there is nothing to wait for.
 *
 * What it cost is the double-click that used to start writing in place. That
 * gesture now belongs to opening, so editing moved to the pencil on the note's
 * own toolbar — the ability is intact, the shortcut is not.
 *
 * Text is held here rather than driven by the row, and the modal is handed the
 * same state: one note cannot disagree with itself while both views are open,
 * and a refetch of the list cannot reach in and replace a half-written
 * sentence.
 */
export function NoteCard({
  note,
  isFlashing = false,
  onSelect,
}: {
  note: StickyNote;
  /** Briefly ringed after being arrived at from search — see `NotesGrid`. */
  isFlashing?: boolean;
  /** Selection, resolved against the wall's order — see `useRowSelection`. */
  onSelect: (modifiers: RowSelectModifiers, id: string) => void;
}) {
  const { saveContent, patchAppearance, removeNote, isRemoving } =
    useNoteMutations(note.id);

  // Seeded once. The row's `content` is not read again for the life of this
  // card, deliberately — see above.
  const [content, setContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const articleRef = useRef<HTMLElement>(null);

  const isSelected = useNoteSelectionStore(selectIsRowSelected(note.id));
  const hasSelection = useNoteSelectionStore(selectHasSelection);
  const toggle = useNoteSelectionStore((state) => state.toggle);

  const appearance = toNoteAppearance(note);

  const handleChange = (value: string) => {
    setContent(value);
    saveContent(value);
  };

  const startEditing = () => {
    setIsEditing(true);
    // Focused on the next frame, once the fields have lost `readOnly`.
    window.requestAnimationFrame(() =>
      articleRef.current
        ?.querySelector<HTMLElement>('[data-note-field="body"]')
        ?.focus(),
    );
  };

  const rowProps = useRowInteraction({
    rowKey: note.id,
    hasSelection,
    onToggle: () => toggle(note.id),
    onOpen: () => setIsOpen(true),
    onSelect: (modifiers) => onSelect(modifiers, note.id),
  });

  // While the note is being written on, the card stops answering gestures: a
  // click belongs to the caret, and a stray double-click should not throw the
  // modal open over the sentence being typed. The key and the tab stop stay
  // behind, though — without them the wall loses track of which card this is,
  // and the background click reads it as empty space and drops the selection.
  const gestures = isEditing
    ? { tabIndex: 0, [ROW_ATTRIBUTE]: note.id }
    : rowProps;

  return (
    <>
      <article
        ref={articleRef}
        {...gestures}
        data-note-id={note.id}
        // `data-selected` rather than `aria-selected`: an `article` has no role
        // that takes it. Saying it properly would mean making the wall a
        // listbox and every card an option, which is a bigger change to how a
        // screen reader reads this page than a selection warrants right now.
        data-selected={isSelected || undefined}
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
          // `group/note` is what the toolbar hangs its hover off, and
          // `relative` is what it positions against.
          "group/note relative flex h-56 flex-col overflow-hidden rounded-lg border shadow-sm transition-opacity",
          !isEditing && "cursor-default select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // A ring rather than the table's border trick: a card has one box of
          // its own to draw on, where a row has to borrow its cells'.
          isSelected &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background",
          isRemoving && "pointer-events-none opacity-50",
          isFlashing && "note-flash",
        )}
      >
        {/*
          Floated over the note rather than given a row of its own, so what you
          see when you are not reaching for it is the whole note. Absolute, so
          the editor below starts at the top of the card instead of under a
          strip that is invisible most of the time.

          Four ways in, because a card can be reached four ways: hover for a
          mouse, `focus-within` for a keyboard — `opacity-0` leaves a button
          focusable but unseeable, which is worse than not having it —
          always-on where the pointer cannot hover at all, since a phone would
          otherwise never get the toolbar to appear, and `has-data-[state=open]`
          for as long as one of its own menus is up.

          That last one is not a nicety. The palette and the actions menu open
          into portals at the far end of the document, so walking the pointer
          across to one leaves the card, hover ends, and the toolbar it came
          from fades out from under the menu still standing open. Radix leaves
          `data-state="open"` on the trigger, which stays inside this toolbar —
          so the toolbar can hold itself up for exactly as long as it is being
          used.
        */}
        <NoteToolbar
          appearance={appearance}
          onAppearanceChange={(patch) => void patchAppearance(patch)}
          onDelete={() => void removeNote()}
          onEdit={startEditing}
          className={cn(
            "absolute top-0 right-0 z-10 gap-1 p-0.5",
            "opacity-0 transition-opacity",
            "group-hover/note:opacity-100 group-focus-within/note:opacity-100",
            "has-data-[state=open]:opacity-100",
            "[@media(hover:none)]:opacity-100",
          )}
        />

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
