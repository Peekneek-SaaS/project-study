import type { CSSProperties } from "react";

import {
  noteAppearanceStyle,
  type NoteAppearance,
} from "@/features/sticky-notes/lib/note-appearance";

/**
 * A surface painted as the note's own paper.
 *
 * The same treatment `NoteCard` and `NoteModal` give themselves, extracted
 * because the annotation popovers need it too and three copies of it would
 * eventually be three slightly different papers. Everything per-note arrives as
 * a custom property, so the stylesheet stays free of anything specific to one
 * note, and the three concrete values are pulled back out for the properties
 * that actually paint.
 *
 * `color` is the part that is easy to leave off and the part that matters most
 * in dark mode. The note palette has no dark block on purpose — a note is the
 * colour it was written on, so amber at midnight is amber — but the *app's*
 * foreground does flip, and anything inside that does not name a colour
 * inherits it. Without this, every icon and label in the popover comes out
 * white on paper that is light in every theme.
 */
export function paperStyle(appearance: NoteAppearance): CSSProperties {
  return {
    ...markerStyle(appearance),
    backgroundColor: "var(--note-bg)",
    borderColor: "var(--note-edge)",
    color: "var(--note-ink)",
  };
}

/**
 * The one colour on a note that has to survive being three pixels wide.
 *
 * The paper tokens are a palette for *surfaces* — pale by design, because they
 * sit behind text that has to stay readable on them. At the size of a marker
 * that is a pastel speck on a white page, which is exactly what "I cannot see
 * where my notes are" means. Even the edge token, picked to be a lip on the
 * paper rather than a mark on a page, is too light on its own.
 *
 * So the dot gets a value of its own, mixed from the edge towards black. In
 * `oklch` rather than the default space: mixing towards black in sRGB
 * desaturates on the way down and an amber note arrives at a muddy brown, where
 * oklch darkens while keeping the hue the note is recognisably wearing.
 *
 * Included in `paperStyle` as well, so a popover can paint a swatch in the same
 * colour as the dot that opened it without composing the two by hand.
 */
export function markerStyle(appearance: NoteAppearance): CSSProperties {
  return {
    ...noteAppearanceStyle(appearance),
    "--note-marker": "color-mix(in oklch, var(--note-edge), black 30%)",
  } as CSSProperties;
}

/**
 * What a popover needs beyond the colours to stop looking like a menu.
 *
 * The ring is the popover's own `ring-foreground/10`, re-pointed at the paper's
 * lip so the note reads as an object with an edge rather than a rectangle with
 * a grey halo. The button rules are the same fix `NoteModal` applies to the
 * dialog's close button, generalised: a ghost button's hover is `bg-muted` and
 * `text-foreground`, which on light paper in dark mode is a dark chip with
 * white text. Every control in here stays on the paper's own terms instead.
 */
export const PAPER_POPOVER =
  "ring-[color:var(--note-edge)] " +
  "[&_[data-slot=button]]:hover:bg-black/5 " +
  "[&_[data-slot=button]]:hover:text-[color:var(--note-ink)]";

/** Divider lines inside paper: the note's own lip, not the app's border. */
export const PAPER_DIVIDER = "border-[color:var(--note-edge)]";
