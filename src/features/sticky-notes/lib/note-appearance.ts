/**
 * Everything a note looks like, in one place.
 *
 * This module is the single source of truth for note appearance, and it is
 * deliberately free of React and of any particular note. A per-note popover
 * edits one row's values through it; the settings modal, when it arrives, will
 * edit the defaults through the same names and the same controls. Neither has
 * to know about the other.
 *
 * Values are stored as *keys*, never as CSS: a row says `amber`, and the
 * `--note-*` tokens in `globals.css` say what amber is. That indirection is
 * what lets the whole palette be retuned without touching a single row.
 *
 * It is not there to make notes follow the theme, and they do not — amber is
 * the same amber in dark mode as in light. A note is meant to be the colour it
 * was written on. See the tokens for the longer version.
 */

export const NOTE_COLORS = [
  "amber",
  "rose",
  "violet",
  "sky",
  "emerald",
  "slate",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_TEXT_COLORS = ["ink", "muted", "crimson", "indigo"] as const;

export type NoteTextColor = (typeof NOTE_TEXT_COLORS)[number];

/**
 * A colour a note can be, as it is stored.
 *
 * One of the named papers above, in every note this app will write from now on:
 * a key, resolved through the `--note-*` tokens, which is what lets the palette
 * be retuned without touching a row.
 *
 * Typed as `string` rather than as the union, because for a while these could
 * also be a `#rrggbb` from a colour picker, and rows written then are still in
 * the database. Those still *render* — see `noteAppearanceStyle` — they simply
 * cannot be chosen again, and picking any paper replaces one. Reading is
 * forgiving, writing is not: the router takes the enum and nothing else.
 */
export type NoteColorValue = string;

/** A colour written by hand, back when the picker offered one. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** Names for the picker. The keys are storage; these are for people. */
export const NOTE_COLOR_LABELS: Record<NoteColor, string> = {
  amber: "Amber",
  rose: "Rose",
  violet: "Violet",
  sky: "Sky",
  emerald: "Emerald",
  slate: "Slate",
};

export const NOTE_TEXT_COLOR_LABELS: Record<NoteTextColor, string> = {
  ink: "Ink",
  muted: "Muted",
  crimson: "Crimson",
  indigo: "Indigo",
};

/**
 * The hands a note can be written in.
 *
 * A short list rather than a font picker, for the reason the colours are a
 * short list: a note is a small square of text, and the choice worth offering
 * is "what kind of thing is this" — a typed note, a written one, a bit of code
 * — not which of four hundred families it is set in. The stacks themselves live
 * with the other note tokens in `globals.css`.
 */
export const NOTE_FONT_FAMILIES = ["sans", "serif", "mono", "hand"] as const;

export type NoteFontFamily = (typeof NOTE_FONT_FAMILIES)[number];

export const NOTE_FONT_FAMILY_LABELS: Record<NoteFontFamily, string> = {
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
  hand: "Hand",
};

/**
 * The colours a run of text can be marked in.
 *
 * A closed set, for the reason the papers are one: a highlighter is a physical
 * thing with five caps on the desk, and any-colour-at-all mostly produces
 * marks that the ink underneath cannot be read through. All five are pale on
 * purpose — they sit *under* the note's own ink, which is dark in every theme.
 *
 * Hexes rather than tokens, and this is the one place that is right: the value
 * is written into the note's own HTML, where a `var()` would resolve against
 * whatever the surrounding document happens to define. A mark made today has
 * to still be that colour in a note read anywhere else.
 */
export const NOTE_HIGHLIGHTS = [
  { key: "yellow", label: "Yellow", hex: "#fff176" },
  { key: "green", label: "Green", hex: "#b9f6ca" },
  { key: "blue", label: "Blue", hex: "#b3e5fc" },
  { key: "pink", label: "Pink", hex: "#f8bbd0" },
  { key: "orange", label: "Orange", hex: "#ffe0b2" },
] as const;

/** The set the sanitiser checks a stored mark against. */
export const NOTE_HIGHLIGHT_HEXES: ReadonlySet<string> = new Set(
  NOTE_HIGHLIGHTS.map((highlight) => highlight.hex),
);

/**
 * Font sizes, as a fixed ladder rather than a free number.
 *
 * A note is a fixed box; letting the size be anything would let it be a size
 * that fits nothing. Stepping through known values also keeps the ruled lines
 * aligned, since each has a line height picked to match.
 */
export const NOTE_FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;

export type NoteFontSize = (typeof NOTE_FONT_SIZES)[number];

export const MIN_NOTE_FONT_SIZE = NOTE_FONT_SIZES[0];
export const MAX_NOTE_FONT_SIZE = NOTE_FONT_SIZES[NOTE_FONT_SIZES.length - 1];

/** Ruled lines are drawn at the text's own line height, so writing sits on them. */
export const NOTE_LINE_HEIGHT_RATIO = 1.6;

/** The whole of what can be customised — per note now, globally later. */
export interface NoteAppearance {
  color: NoteColorValue;
  textColor: NoteColorValue;
  fontFamily: NoteFontFamily;
  fontSize: number;
  showGrid: boolean;
}

/**
 * What a control may ask to change.
 *
 * Narrower than `NoteAppearance` on the two colours, and that asymmetry is the
 * point: a note *read* out of the database may be wearing a hex from when the
 * picker existed, but nothing may *write* one any more. Reading is forgiving,
 * writing is the named set — and saying so here means the compiler catches a
 * control that tries to send something else rather than the router refusing it
 * at runtime.
 */
export interface NoteAppearancePatch {
  color?: NoteColor;
  textColor?: NoteTextColor;
  fontFamily?: NoteFontFamily;
  fontSize?: number;
  showGrid?: boolean;
}

/**
 * What a note looks like before anyone has an opinion.
 *
 * The settings modal will override these; until it does, they are also what
 * `create` falls back to. Kept here rather than in the Prisma schema's column
 * defaults so both ends agree without a migration.
 */
export const DEFAULT_NOTE_APPEARANCE: NoteAppearance = {
  color: "amber",
  textColor: "ink",
  fontFamily: "sans",
  fontSize: 14,
  showGrid: false,
};

/** A colour for a note nobody has chosen one for. */
export function randomNoteColor(): NoteColor {
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

/**
 * Reads a stored row back into an appearance.
 *
 * The columns are plain `String`s and `Int`s, so anything could be in them —
 * an older palette key, a hand-edited row. Unrecognised values fall back to the
 * default rather than reaching a stylesheet that has no rule for them, which
 * would render an unstyled note with no way to tell why.
 */
export function toNoteAppearance(row: {
  color: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  showGrid: boolean;
}): NoteAppearance {
  return {
    color:
      isNoteColor(row.color) || isHexColor(row.color)
        ? row.color
        : DEFAULT_NOTE_APPEARANCE.color,
    textColor:
      isNoteTextColor(row.textColor) || isHexColor(row.textColor)
        ? row.textColor
        : DEFAULT_NOTE_APPEARANCE.textColor,
    fontFamily: isNoteFontFamily(row.fontFamily)
      ? row.fontFamily
      : DEFAULT_NOTE_APPEARANCE.fontFamily,
    fontSize: clampFontSize(row.fontSize),
    showGrid: row.showGrid,
  };
}

export function isNoteColor(value: string): value is NoteColor {
  return (NOTE_COLORS as readonly string[]).includes(value);
}

export function isNoteTextColor(value: string): value is NoteTextColor {
  return (NOTE_TEXT_COLORS as readonly string[]).includes(value);
}

export function isNoteFontFamily(value: string): value is NoteFontFamily {
  return (NOTE_FONT_FAMILIES as readonly string[]).includes(value);
}

export function clampFontSize(size: number) {
  if (!Number.isFinite(size)) return DEFAULT_NOTE_APPEARANCE.fontSize;
  return Math.min(MAX_NOTE_FONT_SIZE, Math.max(MIN_NOTE_FONT_SIZE, size));
}

/**
 * The CSS variables a note is painted with.
 *
 * Returned as a style object rather than as class names because two of the four
 * values are numbers: the font size and the line height derived from it, which
 * the ruled lines are drawn at. Handing them over as variables keeps the note's
 * stylesheet free of anything per-note.
 */
export function noteAppearanceStyle(
  appearance: NoteAppearance,
): React.CSSProperties {
  const isNamed = isNoteColor(appearance.color);

  return {
    "--note-bg": isNamed ? `var(--note-${appearance.color})` : appearance.color,
    /*
      A named paper has an edge token picked to go with it. One of the old
      hand-picked colours has to derive its own — mixed towards black in
      `oklch`, which darkens without the muddy detour through sRGB that mixing
      in the default space would take — so those notes still read as an object
      with a lip rather than a flat rectangle.
    */
    "--note-edge": isNamed
      ? `var(--note-${appearance.color}-edge)`
      : `color-mix(in oklch, ${appearance.color} 85%, black)`,
    "--note-ink": isNoteTextColor(appearance.textColor)
      ? `var(--note-ink-${appearance.textColor})`
      : appearance.textColor,
    "--note-font-family": `var(--note-font-${appearance.fontFamily})`,
    "--note-font-size": `${appearance.fontSize}px`,
    "--note-line-height": `${appearance.fontSize * NOTE_LINE_HEIGHT_RATIO}px`,
  } as React.CSSProperties;
}

/**
 * The most a note can hold.
 *
 * Here rather than in the router so the client can respect it before asking.
 * Pasting a long passage into a note is the one path that can genuinely reach
 * this, and finding out through a validation error after the modal has closed
 * is a much worse way to learn it than being told while choosing.
 */
export const MAX_NOTE_CONTENT = 10_000;
