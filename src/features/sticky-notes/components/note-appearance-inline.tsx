"use client";

import { Grid2X2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NOTE_FONT_FAMILIES,
  NOTE_FONT_FAMILY_LABELS,
  NOTE_FONT_SIZES,
  clampFontSize,
  type NoteAppearance,
  type NoteAppearancePatch,
  type NoteFontFamily,
} from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * How a note looks, on the same row as how its words are formatted.
 *
 * There is no popover any more, and that is the whole point of this file. The
 * palette used to be a button that opened a panel of five controls — two clicks
 * and a layer of chrome to make text bigger, on a surface whose entire subject
 * is one short note. On the bar they are simply *there*: the font, the size,
 * the two colours and the ruling, next to the bold and the lists, all of them
 * one press away and all of them showing their current value without being
 * asked.
 *
 * Presentational and note-agnostic, as the panel it replaces was: it takes a
 * value and reports a patch, and has no idea whether it is pointed at one
 * note's row or at an account default.
 */

/**
 * How a row in one of these lists reads: pointed at, and chosen.
 *
 * One brand colour at two strengths rather than two unrelated greys. A tint
 * under the pointer says "this is what you would be picking"; the solid fill
 * says "this is what is on" — and the tick alone was never going to say the
 * second one at this size, sitting at the far right of a narrow menu in the
 * same ink as everything else.
 *
 * Radix drives both from `focus`, not `hover`: it moves focus to whatever the
 * pointer is over so that the mouse and the arrow keys highlight the same row
 * by the same rule. Hence `focus:` throughout — hovering *is* focusing here.
 *
 * The checked row names its own focus colours too, and that is the part that is
 * easy to leave out: without them the selected row would drop to the hover tint
 * the moment the cursor crossed it, which reads as the selection moving. It
 * goes a shade deeper instead, so it still answers the pointer.
 *
 * The `**:` pair at the end is what actually colours the words, and the reason
 * it is needed is worth writing down. `SelectItem` ships
 * `focus:**:text-accent-foreground` — a *descendant* rule — and the label is
 * not the item, it is a `span` inside it (Radix's `ItemText`). So styling the
 * item alone left the base rule to win on the span, and a selected row went
 * black-on-primary the moment the pointer touched it. `!` because the two
 * selectors weigh the same and the tie would otherwise be settled by whichever
 * utility Tailwind happened to emit last.
 */
/** A select on the note's paper — see the note at the first call site. */
const TRIGGER_ON_PAPER =
  "border-black/15 bg-white/50 text-[color:var(--note-ink)] dark:border-black/20 dark:bg-white/50";

const LIST_ITEM = cn(
  "focus:bg-primary/10 focus:text-foreground focus:**:text-foreground!",
  "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
  "data-[state=checked]:focus:bg-primary/90 data-[state=checked]:focus:text-primary-foreground",
  "data-[state=checked]:**:text-primary-foreground! data-[state=checked]:focus:**:text-primary-foreground!",
);

export function NoteAppearanceInline({
  value,
  /**
   * The size to *show*, when the text under the caret is not the note's own.
   *
   * The note has one default size and any run of it may have been given
   * another, so this control has to describe the words being pointed at rather
   * than the note as a whole. Supplied by the editor, which is the only thing
   * that can see the caret. `null` means "nothing special here" — show the
   * note's size.
   */
  fontSizeValue,
  onChange,
}: {
  value: NoteAppearance;
  fontSizeValue?: number | null;
  /** A patch of what changed, never the whole object — see the router's `update`. */
  onChange: (patch: NoteAppearancePatch) => void;
}) {
  // A size the ladder does not have — an old row, or a run sized before the
  // ladder changed — falls back to the note's own rather than leaving the
  // control blank.
  const shownSize =
    fontSizeValue !== null &&
    fontSizeValue !== undefined &&
    (NOTE_FONT_SIZES as readonly number[]).includes(fontSizeValue)
      ? fontSizeValue
      : clampFontSize(value.fontSize);
  return (
    /*
      A fragment, not a box, and that is the whole layout decision.

      Wrapped in a flex container of its own, this group was a single child of
      the bar: the bar could only wrap *around* it, so the formatting buttons
      were pushed to the far end or onto a line by themselves — near enough to
      reach, far enough to read as a different toolbar. As siblings, every
      control on the bar is in one flow and they wrap together, which is what
      makes bold sit beside the swatches instead of across the room from them.
    */
    <>
      {/* Each option set in the font it names, which is the whole of the
          preview anyone needs at this size. */}
      <Select
        value={value.fontFamily}
        onValueChange={(fontFamily) =>
          onChange({ fontFamily: fontFamily as NoteFontFamily })
        }
      >
        <SelectTrigger
          size="sm"
          aria-label="Font"
          title="Font"
          /*
            Neutral in both themes, because what is behind it is the note.

            Left to the app's own tokens these were a dark box with white text
            in dark mode, sitting on light paper — the control looked like it
            had been cut out of another window. A translucent white chip with
            the note's ink on it reads the same way whatever the theme is doing,
            and over any of the six papers.
          */
          className={cn("w-[6.5rem]", TRIGGER_ON_PAPER)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NOTE_FONT_FAMILIES.map((fontFamily) => (
            <SelectItem
              key={fontFamily}
              value={fontFamily}
              style={{ fontFamily: `var(--note-font-${fontFamily})` }}
              className={LIST_ITEM}
            >
              {NOTE_FONT_FAMILY_LABELS[fontFamily]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/*
        The ladder, as a list. Same fixed values either way — the sizes are
        fixed so the ruled lines stay aligned with the text — but a list says
        what the other sizes *are*, which a pair of steppers never did.

        Stored as a number and spoken as a string, because that is the only
        thing a `<select>` can hold.
      */}
      <Select
        value={String(shownSize)}
        onValueChange={(next) =>
          onChange({ fontSize: clampFontSize(Number(next)) })
        }
      >
        <SelectTrigger
          size="sm"
          aria-label="Text size"
          title="Text size"
          className={cn("w-[4.75rem]", TRIGGER_ON_PAPER)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NOTE_FONT_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)} className={LIST_ITEM}>
              {size} px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* A pressed button rather than a switch with a label beside it: on a row
          of icons a switch is the one control that needs words to be read. */}
      <Button
        variant="note"
        size="icon-sm"
        aria-label="Ruled lines"
        aria-pressed={value.showGrid}
        title="Ruled lines"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onChange({ showGrid: !value.showGrid })}
        // style={{ color: "var(--note-ink)" }}
        // Hover named explicitly, for the reason `FormatButton` gives: the
        // ghost variant's `hover:text-foreground` is white in dark mode.
        className={cn("", value.showGrid && "border-primary")}
      >
        <Grid2X2 />
      </Button>
    </>
  );
}
