/**
 * Row outlines for the drive table.
 *
 * Drawn on the cells rather than the row: the table collapses its borders, and
 * in that model a `<tr>` paints neither a box-shadow (so `ring-*` does nothing)
 * nor a border that beats the cells' own. Cell borders win the collapse, which
 * is exactly what an outline around a row needs.
 */

/** The row is selected. Keyed off `data-state` so the row only sets it once. */
export const SELECTED_ROW_CLASS = [
  "data-[state=selected]:bg-primary/10",
  "data-[state=selected]:[&>td]:border-y data-[state=selected]:[&>td]:border-primary",
  "data-[state=selected]:[&>td:first-child]:border-l",
  "data-[state=selected]:[&>td:last-child]:border-r",
].join(" ");

/** Something is being dragged over the row. Applied conditionally. */
export const DROP_TARGET_ROW_CLASS = [
  "bg-accent",
  "[&>td]:border-y [&>td]:border-primary",
  "[&>td:first-child]:border-l [&>td:last-child]:border-r",
].join(" ");
