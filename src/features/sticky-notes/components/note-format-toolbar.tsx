"use client";

import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NoteInlineFormat = "bold" | "italic" | "underline";
export type NoteListFormat = "bullet" | "ordered";

/** Which formats the caret is currently sitting in — see `noteFormatState`. */
export interface NoteFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bullet: boolean;
  ordered: boolean;
  link: boolean;
}

/**
 * Reads back what the browser says about the selection.
 *
 * `queryCommandState` is the other half of `execCommand` and carries the same
 * deprecation, but it is the only thing that can answer "is the caret in bold
 * text" without walking the DOM upwards and reimplementing the browser's own
 * idea of what counts. The buttons need that answer to light up, and a toolbar
 * whose Bold does not look pressed inside bold text is a toolbar that has to be
 * tried to be understood.
 *
 * Guarded, because a document with no selection at all throws rather than
 * returning false in some browsers.
 */
export function noteFormatState(isLink: boolean): NoteFormatState {
  const state = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };

  return {
    bold: state("bold"),
    italic: state("italic"),
    underline: state("underline"),
    bullet: state("insertUnorderedList"),
    ordered: state("insertOrderedList"),
    link: isLink,
  };
}

/**
 * The formatting buttons, over the note they act on.
 *
 * They hold no text and no selection — the field does, because the field is the
 * thing the browser is editing. This reports which button was pressed and shows
 * which formats are already on.
 *
 * `onMouseDown` with `preventDefault`, on every button, and it is load-bearing:
 * clicking a button would otherwise blur the editable region, and a blurred
 * region has no selection left to embolden. Preventing the default keeps focus
 * and the selection exactly where they were, so the press applies to the words
 * the user was looking at.
 */
export function NoteFormatToolbar({
  state,
  onInline,
  onList,
  onLink,
}: {
  state: NoteFormatState;
  onInline: (format: NoteInlineFormat) => void;
  onList: (format: NoteListFormat) => void;
  onLink: () => void;
}) {
  /*
    A fragment, not a box, and that is the whole layout decision.

    Wrapped in a flex container of its own, these buttons were a single child of
    the bar: the bar could only wrap *around* them, so they were pushed to the
    far end or onto a line by themselves — near enough to reach, far enough to
    read as a separate toolbar. As siblings they are in the bar's own flow, and
    bold sits beside the swatches rather than across the room from them.
  */
  return (
    <>
      <FormatButton
        label="Bold"
        isActive={state.bold}
        onPress={() => onInline("bold")}
      >
        <Bold />
      </FormatButton>
      <FormatButton
        label="Italic"
        isActive={state.italic}
        onPress={() => onInline("italic")}
      >
        <Italic />
      </FormatButton>
      <FormatButton
        label="Underline"
        isActive={state.underline}
        onPress={() => onInline("underline")}
      >
        <Underline />
      </FormatButton>

      <FormatButton
        label="Bulleted list"
        isActive={state.bullet}
        onPress={() => onList("bullet")}
      >
        <List />
      </FormatButton>
      <FormatButton
        label="Numbered list"
        isActive={state.ordered}
        onPress={() => onList("ordered")}
      >
        <ListOrdered />
      </FormatButton>

      {/* The one button that opens something. Named for what it does in each
          state, because "Link" on a word that is already one is a lie about
          which dialog is about to appear. */}
      <FormatButton
        label={state.link ? "Edit link" : "Add link"}
        isActive={state.link}
        onPress={onLink}
      >
        <LinkIcon />
      </FormatButton>
    </>
  );
}

function FormatButton({
  label,
  isActive,
  onPress,
  children,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="note"
      size="icon-sm"
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      // See the note on the component above — without this the selection is
      // gone before the click lands.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      // style={{ color: "var(--note-ink)" }}
      // The resting colour is inherited — the dialog hands the whole paper the
      // note's ink. Hover has to be said out loud though: `variant="ghost"`
      // carries `hover:text-foreground`, which in dark mode is white, and white
      // on paper that is light in every theme is an icon that vanishes under
      // the pointer.
      className={cn("", isActive && "border-primary")}
    >
      {children}
    </Button>
  );
}
