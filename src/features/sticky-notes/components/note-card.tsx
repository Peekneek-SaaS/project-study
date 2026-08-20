"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";

import { NoteEditor } from "@/features/sticky-notes/components/note-editor";
import { NoteModal } from "@/features/sticky-notes/components/note-modal";
import { NoteToolbar } from "@/features/sticky-notes/components/note-toolbar";
import { useNoteMutations } from "@/features/sticky-notes/hooks/use-note-mutations";
import {
  noteAppearanceStyle,
  toNoteAppearance,
} from "@/features/sticky-notes/lib/note-appearance";
import { noteDisplayTitle } from "@/features/sticky-notes/lib/note-content";
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
import { layoutTransition, listItem, presenceAnimation } from "@/lib/motion";
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
  documentId,
}: {
  note: StickyNote;
  /** Briefly ringed after being arrived at from search — see `NotesGrid`. */
  isFlashing?: boolean;
  /** Selection, resolved against the wall's order — see `useRowSelection`. */
  onSelect: (modifiers: RowSelectModifiers, id: string) => void;
  /**
   * Set when this card is on a document's work page, so edits are written back
   * to that document's list rather than to the wall of standalone notes.
   */
  documentId?: string;
}) {
  const {
    saveContent,
    patchAppearance,
    removeNote,
    isRemoving,
    hasPendingContent,
  } = useNoteMutations(note.id, documentId);

  const [content, setContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  /*
    The row as the server last described it — and the gate for taking a newer
    one.

    This card holds the text rather than reading it off the row, so a refetch
    cannot replace a half-written sentence. That is still right, but it was too
    absolute: it also ignored writes that came from somewhere else entirely.
    Sending a passage from a chat answer into a note appends to it on the
    server, the list refetches with the new text, and this card carried on
    showing the copy it seeded with — the note "only updated on refresh",
    because a reload was the only thing that mounted a fresh card.

    So a change in the row is adopted, unless this card is the one causing it:
    not while it is being written on, not while its modal is open, and not
    while a keystroke is still sitting in the debounce. Any of those means the
    text on screen is *newer* than the row, and the row would be overwriting it.

    Adjusted during the render that sees the change rather than in an effect —
    the pattern the day sections and the link dialog use — so the new text
    paints in the same frame instead of one after it.
  */
  const [knownContent, setKnownContent] = useState(note.content);
  if (note.content !== knownContent) {
    setKnownContent(note.content);
    if (!isEditing && !isOpen && !hasPendingContent()) setContent(note.content);
  }

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
      <motion.article
        ref={articleRef}
        variants={listItem}
        {...presenceAnimation}
        // Position only, so the wall closing over a deleted note slides the
        // cards across rather than stretching what is written on them.
        layout="position"
        // A note lifts a little under the pointer and presses in when clicked,
        // which is most of what makes a card feel like an object. Spring rather
        // than a duration: the weight is what reads as physical, and a hand
        // moving on and off a card faster than any fixed timing can follow is
        // exactly what a spring handles and a tween does not.
        whileHover={isEditing ? undefined : { y: -3, scale: 1.01 }}
        whileTap={isEditing ? undefined : { scale: 0.995 }}
        // The `layout` key is the wall's own, slower spring — the hover spring
        // above is meant for a card chasing the pointer, and a note sliding half
        // the grid to close a gap on it would arrive before the eye did.
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
          mass: 0.6,
          layout: layoutTransition,
        }}
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
          // The card is one surface. The fields on top paint it too, but a
          // note whose colour depended on its children covering every pixel is
          // a note that shows a seam the first time one of them does not.
          backgroundColor: "var(--note-bg)",
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

          Four ways in, because a card gets reached four ways.

          `group-hover` is the mouse. `group-focus-within` is the keyboard —
          `opacity-0` leaves a button focusable but unseeable, which is worse
          than not having the button at all.

          `group-data-[selected]` is the touch answer, and the reason there is
          no `@media (hover: none)` rule here any more. A phone cannot hover, so
          the toolbar used to be pinned open on every card at once — a wall of
          chrome sitting on top of the notes it belongs to. Selecting one note
          is the gesture that says "this one", so that is what shows its
          toolbar. Hold to select, and it appears; the actions are also a tap
          away inside the note, where the modal carries the same toolbar
          permanently.

          `has-data-[state=open]` holds it up while one of its own menus is
          open, and is not a nicety: the palette and the actions menu open into
          portals at the far end of the document, so walking the pointer across
          to one leaves the card, hover ends, and the toolbar it came from fades
          out from under a menu still standing open. Radix leaves
          `data-state="open"` on the trigger, which stays inside this toolbar.
        */}
        <NoteToolbar
          onDelete={() => void removeNote()}
          onEdit={startEditing}
          noteTitle={noteDisplayTitle(content)}
          isDeleting={isRemoving}
          className={cn(
            "absolute top-0 right-0 z-10 gap-1 p-0.5",
            "opacity-0 transition-opacity",
            "group-hover/note:opacity-100 group-focus-within/note:opacity-100",
            "group-data-selected/note:opacity-100",
            "has-data-[state=open]:opacity-100",
          )}
        />

        <NoteEditor
          content={content}
          onChange={handleChange}
          appearance={appearance}
          readOnly={!isEditing}
        />
      </motion.article>

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
