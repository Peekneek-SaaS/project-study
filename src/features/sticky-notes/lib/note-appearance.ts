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
  color: NoteColor;
  textColor: NoteTextColor;
  fontSize: number;
  showGrid: boolean;
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
  fontSize: number;
  showGrid: boolean;
}): NoteAppearance {
  return {
    color: isNoteColor(row.color) ? row.color : DEFAULT_NOTE_APPEARANCE.color,
    textColor: isNoteTextColor(row.textColor)
      ? row.textColor
      : DEFAULT_NOTE_APPEARANCE.textColor,
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

export function clampFontSize(size: number) {
  if (!Number.isFinite(size)) return DEFAULT_NOTE_APPEARANCE.fontSize;
  return Math.min(MAX_NOTE_FONT_SIZE, Math.max(MIN_NOTE_FONT_SIZE, size));
}

/** The next size up or down the ladder, or the same one at either end. */
export function stepFontSize(size: number, direction: 1 | -1): number {
  const sizes = NOTE_FONT_SIZES;
  const current = sizes.indexOf(clampFontSize(size) as NoteFontSize);

  // A size off the ladder entirely (an older row, a changed ladder) steps to
  // the nearest rung rather than refusing to move.
  if (current === -1) {
    const nearest = sizes.reduce((best, candidate) =>
      Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best,
    );
    return nearest;
  }

  return sizes[Math.min(sizes.length - 1, Math.max(0, current + direction))];
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
  return {
    "--note-bg": `var(--note-${appearance.color})`,
    "--note-edge": `var(--note-${appearance.color}-edge)`,
    "--note-ink": `var(--note-ink-${appearance.textColor})`,
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
