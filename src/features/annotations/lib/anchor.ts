/**
 * Turning a text selection into somewhere a dot can live, and back.
 *
 * The whole of the anchoring problem is that the two coordinate systems
 * involved disagree with each other constantly. A selection reports itself in
 * *viewport* pixels, which change when the user scrolls. A page is drawn at
 * whatever size the panel width, the zoom and the layout arrive at, which
 * changes when any of the three moves. Storing either one would produce a note
 * that drifts off its sentence the first time the reader touched anything.
 *
 * What does not change is where the selection sits *within its page* — a
 * sentence a third of the way down stays a third of the way down at every zoom,
 * on every screen, forever. So that fraction is what gets stored, and these two
 * functions are the only places the conversion happens.
 */

/** A rectangle on a page, as fractions of that page's box. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Keeps a fraction inside the page it is meant to describe. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Where a selection sits inside the page element containing it.
 *
 * `pageEl` must be the element whose box *is* the page as laid out — in this
 * viewer that is the `data-page` wrapper, deliberately not the inner div that
 * carries the `scale()` transform. Measuring against the outer box means the
 * arithmetic is the same whether the page is being drawn at full size or
 * stretched by CSS past the rasterisation ceiling, because `getBoundingClientRect`
 * on the outer element already reports the final on-screen size either way.
 *
 * Returns null when the page has no size yet, which happens for a frame while a
 * page is mounting: dividing by zero would store `Infinity` and put the dot in
 * a corner forever.
 */
export function rectToAnchor(
  selectionRect: DOMRect,
  pageEl: HTMLElement,
): AnchorRect | null {
  const page = pageEl.getBoundingClientRect();
  if (page.width <= 0 || page.height <= 0) return null;

  return {
    x: clamp01((selectionRect.left - page.left) / page.width),
    y: clamp01((selectionRect.top - page.top) / page.height),
    width: clamp01(selectionRect.width / page.width),
    height: clamp01(selectionRect.height / page.height),
  };
}

/**
 * The selection as the *lines* it actually covers.
 *
 * `getBoundingClientRect` on a range gives one box around the whole thing,
 * which for a selection that wraps is a block running from the start of the
 * first line to the end of the last — including the left margin of line two and
 * the empty tail of line one, neither of which was selected. Painting that is
 * what "it highlights the whole paragraph" means.
 *
 * `getClientRects` gives a box per laid-out fragment instead, so three lines
 * come back as three rectangles that stop where the text stops. It also comes
 * back noisy — a fragment per text node, zero-width boxes at element edges — so
 * the results are cleaned and merged before they are anything worth storing.
 */
export function rangeToAnchors(range: Range, pageEl: HTMLElement): AnchorRect[] {
  const page = pageEl.getBoundingClientRect();
  if (page.width <= 0 || page.height <= 0) return [];

  const rects = [...range.getClientRects()]
    // Zero-sized boxes are element boundaries rather than text, and a rect
    // taller than the page is a layout still settling.
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => ({
      x: clamp01((rect.left - page.left) / page.width),
      y: clamp01((rect.top - page.top) / page.height),
      width: clamp01(rect.width / page.width),
      height: clamp01(rect.height / page.height),
    }));

  return mergeOnLines(rects);
}

/**
 * Joins fragments that are on the same line into one rectangle each.
 *
 * A styled run — a bold word, a link — is its own text node, so a single line
 * of a selection can arrive as five adjacent boxes. Drawn separately they show
 * hairline seams between the words where the blend modes meet, and each one
 * would be its own hover target. Merged, a line is a line.
 *
 * "Same line" is decided by vertical overlap rather than by an equal `y`:
 * a superscript or a larger word sits a pixel or two higher than its
 * neighbours, and comparing tops exactly would split the line at every one.
 */
function mergeOnLines(rects: AnchorRect[]): AnchorRect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: AnchorRect[] = [];

  for (const rect of sorted) {
    const last = lines[lines.length - 1];

    // Overlapping vertically by more than half the shorter of the two is the
    // same line; anything less is the next one down.
    const overlap = last
      ? Math.min(last.y + last.height, rect.y + rect.height) -
        Math.max(last.y, rect.y)
      : 0;
    const sameLine =
      last !== undefined && overlap > Math.min(last.height, rect.height) / 2;

    if (!sameLine) {
      lines.push({ ...rect });
      continue;
    }

    const left = Math.min(last.x, rect.x);
    const right = Math.max(last.x + last.width, rect.x + rect.width);
    const top = Math.min(last.y, rect.y);
    const bottom = Math.max(last.y + last.height, rect.y + rect.height);

    last.x = left;
    last.y = top;
    last.width = right - left;
    last.height = bottom - top;
  }

  return lines;
}

/** The one box containing all of them — what the row's four columns hold. */
export function unionOfAnchors(rects: AnchorRect[]): AnchorRect | null {
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Whether two rectangles describe the same words.
 *
 * Rounded to three decimals before comparing — about a pixel on a page a
 * thousand across. Selecting the same sentence twice does not produce
 * bit-identical numbers: `getBoundingClientRect` is floating point, and a drag
 * that ends on the same character can differ in the last digit. Comparing
 * exactly would call two identical selections different and let the duplicate
 * through, which is the whole thing this is here to catch.
 */
export function anchorsMatch(a: AnchorRect, b: AnchorRect): boolean {
  const round = (value: number) => value.toFixed(3);
  return (
    round(a.x) === round(b.x) &&
    round(a.y) === round(b.y) &&
    round(a.width) === round(b.width) &&
    round(a.height) === round(b.height)
  );
}

/**
 * Whether two rectangles cover any of the same page.
 *
 * What decides which notes a hover shows. A note on one word inside a note on a
 * whole sentence overlaps it, so hovering the word offers both; a note on the
 * line below overlaps neither, so it stays out of it.
 *
 * Touching edges do not count — two highlights on consecutive lines share a
 * boundary to the pixel, and treating that as an overlap would make every note
 * show its neighbours.
 */
export function anchorsOverlap(a: AnchorRect, b: AnchorRect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/**
 * The rectangles a stored annotation should be painted as.
 *
 * Falls back to the bounding box for rows written before per-line rects
 * existed, and for anything whose `rects` failed to parse — those render as
 * they always did rather than not at all.
 */
export function anchorRectsOf(annotation: {
  x: number;
  y: number;
  width: number;
  height: number;
  rects?: unknown;
}): AnchorRect[] {
  const stored = annotation.rects;
  if (Array.isArray(stored)) {
    const parsed = stored.filter(
      (entry): entry is AnchorRect =>
        typeof entry === "object" &&
        entry !== null &&
        ["x", "y", "width", "height"].every(
          (key) => typeof (entry as Record<string, unknown>)[key] === "number",
        ),
    );
    if (parsed.length > 0) return parsed;
  }

  return [
    {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    },
  ];
}

/**
 * Where the highlight over the annotated words goes.
 *
 * The only positioning this file still does. There was a second function beside
 * it that placed a dot in the margin, from back when the mark was a dot and the
 * words were left alone — the words carry the mark themselves now, so the
 * rectangle is the whole answer.
 */
export function anchorToHighlightStyle(anchor: AnchorRect) {
  return {
    left: `${anchor.x * 100}%`,
    top: `${anchor.y * 100}%`,
    width: `${anchor.width * 100}%`,
    height: `${anchor.height * 100}%`,
  };
}

/**
 * A selection worth offering to annotate.
 *
 * Collapsed ranges and whitespace-only ones are both "the user clicked", not
 * "the user chose something", and a prompt that appeared on every click in the
 * document would be a prompt to be dismissed rather than one to be used.
 */
export function isMeaningfulSelection(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * The quote, cut to something a marker tooltip and a note header can hold.
 *
 * Cut on a word boundary where there is one within reach of the limit, because
 * a quote that stops mid-word reads as data corruption rather than as an
 * excerpt.
 */
export const MAX_QUOTE_LENGTH = 280;

export function truncateQuote(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_QUOTE_LENGTH) return clean;

  const cut = clean.slice(0, MAX_QUOTE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > MAX_QUOTE_LENGTH - 40 ? cut.slice(0, lastSpace) : cut}…`;
}
