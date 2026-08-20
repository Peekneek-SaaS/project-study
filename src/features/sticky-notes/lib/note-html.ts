/**
 * A note's body, as the rich editor stores and reads it.
 *
 * The body is HTML now, not Markdown. The reason is what the reader asked for
 * and what Markdown cannot give: pressing Bold has to embolden the word, not
 * write `**` around it, and Return inside a list has to open the next bullet.
 * Both of those are things `contentEditable` does natively and a plain field
 * over a Markdown string cannot do at all — so the storage follows the editor
 * rather than the editor fighting the storage.
 *
 * Which puts a sanitiser on the critical path. Everything here treats stored
 * HTML as untrusted, always, in both directions: what comes out of the editor
 * before it is saved, and what comes out of the database before it is shown.
 * The allowance is a short, closed list of the tags the toolbar can actually
 * produce — no scripts, no styles, no event handlers, no embedded anything.
 *
 * The first line of `content` is still the note's name and still plain text.
 * Only what follows the first newline is HTML, which is why `normaliseHtml`
 * takes the literal newlines out: a stray one inside the body would move the
 * boundary and turn half a sentence into the title.
 */

import { NOTE_HIGHLIGHT_HEXES } from "@/features/sticky-notes/lib/note-appearance";

/** Tags a note may contain, and the attributes each may carry. */
const ALLOWED_TAGS: Record<string, readonly string[]> = {
  B: [],
  STRONG: [],
  I: [],
  EM: [],
  U: [],
  BR: [],
  DIV: [],
  P: [],
  UL: [],
  OL: [],
  LI: [],
  A: ["href"],
  /*
    The one element allowed to carry a `style`, and it may say exactly one
    thing: how big this run of text is.

    Sizing a selection has nowhere else to live — it is not a tag, it is a
    property of a span of words — so the alternative to admitting this was not
    a tidier representation, it was not having the feature. The attribute is
    rebuilt rather than filtered: whatever arrives is parsed for a font size in
    the app's own ladder and everything else is dropped, so a `style` from a
    paste cannot smuggle in a position, a background or a `url()`.
  */
  SPAN: ["style"],
};

/** The sizes a run of text may be given — the ladder, in px. */
const FONT_SIZE_RANGE = { min: 8, max: 96 } as const;

/** The size in a `style`, if there is a usable one. */
function readFontSize(value: string): number | null {
  const match =
    /(?:^|;)\s*font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px\s*(?:;|$)/i.exec(value);
  if (!match) return null;

  const size = Number(match[1]);
  if (!Number.isFinite(size)) return null;
  if (size < FONT_SIZE_RANGE.min || size > FONT_SIZE_RANGE.max) return null;

  return size;
}

/**
 * The highlight in a `style`, if it is one of the five.
 *
 * Browsers do not write back what they were handed: `execCommand` is given
 * `#fff176` and the DOM comes back saying `rgb(255, 241, 118)`. So both
 * notations are read and both are answered in hex, which is also what makes
 * the membership test possible — comparing an `rgb()` string against a palette
 * of hexes would never match, and every mark would be dropped on the way to the
 * database.
 */
function readHighlight(value: string): string | null {
  const match = /(?:^|;)\s*background-color\s*:\s*([^;]+?)\s*(?:;|$)/i.exec(
    value,
  );
  if (!match) return null;

  const raw = match[1].trim().toLowerCase();

  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(raw);
  const hex = rgb
    ? `#${[rgb[1], rgb[2], rgb[3]]
        .map((part) => Number(part).toString(16).padStart(2, "0"))
        .join("")}`
    : raw;

  return NOTE_HIGHLIGHT_HEXES.has(hex) ? hex : null;
}

/**
 * The two things a `style` may say, rebuilt from scratch.
 *
 * Rebuilt, never filtered, and that is what makes the guarantee simple to
 * state: a `style` on a stored note is a font size in pixels, a highlight from
 * the palette, or both — because this function can only write those. Whatever
 * else arrived — a position, a `url()`, a second colour — is not removed so
 * much as never carried over.
 */
function sanitiseStyle(value: string): string | null {
  const declarations: string[] = [];

  const size = readFontSize(value);
  if (size !== null) declarations.push(`font-size: ${size}px`);

  const highlight = readHighlight(value);
  if (highlight !== null) declarations.push(`background-color: ${highlight}`);

  return declarations.length > 0 ? declarations.join("; ") : null;
}

/**
 * Tags whose *contents* go with them.
 *
 * Everything else unknown is unwrapped — the tag goes, the words stay — which
 * is right for a `<span>` from a paste and wrong for these: what is inside a
 * `<script>` or a `<style>` is code, not prose, and unwrapping one turns
 * `alert(1)` into a sentence in somebody's note. Not an injection, since the
 * tag itself is gone by then and the text is inserted as text — just nonsense
 * appearing in a note, which is its own kind of broken.
 */
const DROP_WITH_CONTENTS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "MATH",
  "CANVAS",
  "LINK",
  "META",
  "HEAD",
  "TITLE",
]);

/**
 * Schemes a link may use.
 *
 * `https` is what the link dialog insists on. `http` and `mailto` are admitted
 * on the way *out* because a note may hold a link pasted before that rule
 * existed, and silently dropping somebody's saved address is worse than showing
 * an insecure one. What is not on this list is the point of the list:
 * `javascript:` and `data:` are how an href becomes an exploit.
 */
const ALLOWED_SCHEMES = ["https:", "http:", "mailto:"];

/** What the link dialog requires — see `isSafeNoteUrl`. */
export const REQUIRED_LINK_PREFIX = "https://";

/**
 * Whether an address is one this app will store.
 *
 * Deliberately stricter than the sanitiser: a person typing a link into the
 * dialog can be asked for `https://`, and asking is much easier to explain than
 * a link that saved and then quietly refused to open.
 */
export function isSafeNoteUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith(REQUIRED_LINK_PREFIX)) return false;

  try {
    const url = new URL(trimmed);
    // A scheme alone is not an address: `https://` parses, and points nowhere.
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isAllowedHref(value: string): boolean {
  try {
    // A relative href has no meaning in a note — there is no page to be
    // relative to — so the base is only here to keep `URL` from throwing.
    const url = new URL(value, "https://invalid.example");
    return ALLOWED_SCHEMES.includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Strips a fragment of HTML down to what a note is allowed to be.
 *
 * Unknown elements are *unwrapped* rather than deleted — their text survives,
 * their tag does not. A note that has been through a paste from a web page
 * should lose the styling and keep the sentence; deleting the node outright
 * would lose the words with it, which reads to the writer as the app having
 * eaten their note.
 *
 * `DOMParser` rather than a regular expression, because HTML is not a regular
 * language and every "sanitiser" written with a regex has the same bug. The
 * parse happens in an inert document: no script runs, no image is fetched, no
 * network is touched — parsing is not rendering.
 */
export function sanitiseNoteHtml(html: string): string {
  if (typeof window === "undefined") return "";

  const parsed = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );

  const clean = (parent: Element): void => {
    // A static copy: unwrapping mutates the live child list underneath us.
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        /*
          The space bar writes a non-breaking space, and it has to be undone.

          Every browser does this in a `contentEditable`: a plain space at the
          end of a run, or the second of two, would be collapsed away by normal
          HTML whitespace rules, so it inserts `\u00A0` — which survives, and
          serialises as `&nbsp;`. The note then holds a character that is not
          the one that was typed: it never wraps, so a long line pushes past the
          edge instead of breaking, and a search for "chapter four" misses a
          note that reads "chapter four" because the space between them is not
          a space.

          Turned back into ordinary spaces here, and the field is given
          `whitespace-pre-wrap` so it no longer needs the substitution — see
          `NoteRichText`. Done on text nodes rather than on the serialised
          string, so an `href` cannot be rewritten by it.
        */
        if (node.nodeValue?.includes("\u00A0")) {
          node.nodeValue = node.nodeValue.replace(/\u00A0/g, " ");
        }
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        continue;
      }

      const element = node as Element;

      /*
        Upper-cased before either list is consulted, and not for tidiness.

        `tagName` is upper case for HTML elements and *as written* for foreign
        ones — SVG and MathML keep their case, because those languages are
        case-sensitive. So `<svg><script>` parses to an element whose `tagName`
        is the lower-case `"script"`, which matched neither list: it fell
        through to the unwrap branch and spilled its code into the note as
        text. Comparing on one case closes that, and closes it for every
        foreign element rather than for the one that was noticed.
      */
      const tag = element.tagName.toUpperCase();

      if (DROP_WITH_CONTENTS.has(tag)) {
        element.remove();
        continue;
      }

      const allowed = ALLOWED_TAGS[tag];

      if (!allowed) {
        clean(element);
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        if (!allowed.includes(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      }

      const href = element.getAttribute("href");
      if (href !== null && !isAllowedHref(href)) {
        element.removeAttribute("href");
      }

      const style = element.getAttribute("style");
      if (style !== null) {
        const kept = sanitiseStyle(style);
        if (kept === null) element.removeAttribute("style");
        else element.setAttribute("style", kept);
      }

      clean(element);

      // A `span` is only ever here to carry a size. Stripped of one — by the
      // rule above, or because it never had a valid one — it is a wrapper
      // around nothing, and every paste would leave another layer of them.
      if (tag === "SPAN" && !element.hasAttribute("style")) {
        element.replaceWith(...Array.from(element.childNodes));
      }
    }
  };

  clean(parsed.body);

  return normaliseHtml(parsed.body.innerHTML);
}

/**
 * Makes a body safe to store on one line.
 *
 * The note's name is everything before the first newline, so a newline in the
 * body would rename the note. HTML says nothing with a literal newline that it
 * does not say with a tag, so collapsing them costs nothing and closes that
 * hole — see this module's header.
 */
export function normaliseHtml(html: string): string {
  return html.replace(/\r?\n/g, " ").trim();
}

const HTML_TAG = /<\/?(?:b|strong|i|em|u|br|div|p|ul|ol|li|a|span)\b[^>]*>/i;

/**
 * Whether a stored body was written by the rich editor.
 *
 * Notes predate it, and theirs are plain text — often with line breaks that
 * matter, sometimes with a stray `<` in them. Guessing from the presence of a
 * tag this app can actually produce is what keeps an old note readable without
 * a migration that would have to guess the same thing, once, irreversibly.
 */
export function looksLikeNoteHtml(body: string): boolean {
  return HTML_TAG.test(body);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** A plain-text note, as HTML that says the same thing. */
export function plainTextToNoteHtml(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
  return escaped.replace(/\r?\n/g, "<br>");
}

/**
 * The body as HTML, whichever way it happens to be stored.
 *
 * The one function the editor and the card both load through, so the two cannot
 * disagree about what an old note is.
 */
export function noteBodyHtml(body: string): string {
  if (body.trim().length === 0) return "";
  return looksLikeNoteHtml(body)
    ? sanitiseNoteHtml(body)
    : plainTextToNoteHtml(body);
}
