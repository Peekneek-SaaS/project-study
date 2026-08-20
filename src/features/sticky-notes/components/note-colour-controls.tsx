"use client";

import { Ban, Highlighter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NOTE_COLOR_LABELS,
  NOTE_COLORS,
  NOTE_HIGHLIGHTS,
  NOTE_TEXT_COLOR_LABELS,
  NOTE_TEXT_COLORS,
  type NoteAppearancePatch,
} from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * The three colour controls, together, each behind its own small popover.
 *
 * Together because they are one question asked three times — what colour is the
 * paper, the ink, the mark — and someone reaching for one is often about to
 * reach for another. Apart from the rest of the bar because they are the only
 * controls on it whose *choices* are colours: the fonts and sizes are lists of
 * words, and a row of thirteen coloured squares between them buried both.
 *
 * Behind popovers because that is what the highlighter proved: a trigger that
 * shows the current colour says everything the row of swatches said, in one
 * target instead of six, and the choices are one click away rather than always
 * underfoot.
 *
 * Two of the three are properties of the note and the third is a property of a
 * selection, which is why the patch and the highlight are separate callbacks
 * rather than one. They only look alike.
 */
export function NoteColourControls({
  onChange,
  onHighlight,
}: {
  /** A patch of what changed, never the whole object — see the router's `update`. */
  onChange: (patch: NoteAppearancePatch) => void;
  /** A colour from the palette, or `null` to take the mark off. */
  onHighlight: (hex: string | null) => void;
}) {
  return (
    <>
      {/*
        The paper. Its trigger is painted with `--note-bg` rather than with the
        chosen key looked up again: that variable is already resolved on the
        surface this sits on, so the button cannot disagree with the note behind
        it — including for a note still wearing a colour from when the picker
        allowed any.
      */}
      <SwatchPopover
        label="Note colour"
        trigger={
          <span
            className="size-4 rounded-sm border"
            style={{
              background: "var(--note-bg)",
              borderColor: "var(--note-edge)",
            }}
          />
        }
      >
        {NOTE_COLORS.map((color) => (
          <Swatch
            key={color}
            label={NOTE_COLOR_LABELS[color]}
            onPress={() => onChange({ color })}
            style={{
              background: `var(--note-${color})`,
              borderColor: `var(--note-${color}-edge)`,
            }}
          />
        ))}
      </SwatchPopover>

      {/* The ink, shown as an `A` in itself: a colour text is *set in* rather
          than a colour a thing *is*. */}
      <SwatchPopover
        label="Text colour"
        trigger={
          <span
            className="text-sm leading-none font-semibold"
            style={{ color: "var(--note-ink)" }}
          >
            A
          </span>
        }
      >
        {NOTE_TEXT_COLORS.map((textColor) => (
          <Swatch
            key={textColor}
            label={NOTE_TEXT_COLOR_LABELS[textColor]}
            onPress={() => onChange({ textColor })}
            style={{ color: `var(--note-ink-${textColor})` }}
            letter="A"
          />
        ))}
      </SwatchPopover>

      {/* The mark. No current colour to show on the trigger, because it does
          not have one — it belongs to whichever words are selected. */}
      <SwatchPopover label="Highlight" trigger={<Highlighter />}>
        {NOTE_HIGHLIGHTS.map((highlight) => (
          <Swatch
            key={highlight.key}
            label={highlight.label}
            onPress={() => onHighlight(highlight.hex)}
            style={{ background: highlight.hex, borderColor: "#00000026" }}
          />
        ))}

        {/* Taking a mark off is the same gesture as putting one on, so it lives
            with the colours rather than in a menu somewhere. */}
        <Swatch
          label="No highlight"
          onPress={() => onHighlight(null)}
          className="text-muted-foreground"
        >
          <Ban className="size-3.5" />
        </Swatch>
      </SwatchPopover>
    </>
  );
}

/**
 * A button on the bar, and the colours it opens.
 *
 * `onMouseDown` prevented on the trigger for the reason everything on this bar
 * does it: the popover's contents act on the note's selection, and a press that
 * moved the focus would take the caret with it before the first colour could be
 * chosen.
 */
function SwatchPopover({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="note"
          size="icon-sm"
          aria-label={label}
          title={label}
          onMouseDown={(event) => event.preventDefault()}
          className="hover:bg-black/5 hover:text-[color:var(--note-ink)]"
        >
          {trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1.5">
        <div className="flex items-center gap-1">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/** One colour inside a popover. */
function Swatch({
  label,
  onPress,
  style,
  letter,
  className,
  children,
}: {
  label: string;
  onPress: () => void;
  style?: React.CSSProperties;
  /** Drawn over the swatch, for the inks — see the call site. */
  letter?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // The popover is over the field, and the field's selection is what these
      // act on — the same guard the triggers carry.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      aria-label={label}
      title={label}
      style={style}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border border-black/15 text-[0.625rem] font-semibold",
        "hover:ring-2 hover:ring-ring/40",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {letter ?? children}
    </button>
  );
}
