/**
 * How the model points at a page.
 *
 * Citations are asked for as ordinary Markdown links with a made-up scheme:
 *
 *   [Biology — Chapter 4, page 5](doc:clx123abc?page=5)
 *
 * A link rather than a sentence, because that is the difference between being
 * *told* where an answer came from and being able to go and look. The scheme is
 * what lets the renderer tell a citation apart from a real URL without the
 * model having to know anything about this app's routes — it names a document
 * and a page, and where those live is decided here rather than by the model.
 *
 * Parsed defensively throughout. This is generated text: the model will
 * occasionally invent a page, drop the query string, or cite a document id that
 * no longer exists, and every one of those has to degrade to something
 * harmless rather than produce a broken link.
 */

/** A citation, once it has been picked apart. */
export interface ParsedCitation {
  documentId: string;
  /** 1-based, or null where the model gave no page. */
  page: number | null;
}

/**
 * `doc:<documentId>` with an optional `?page=<n>`.
 *
 * The id is matched loosely — cuids today, but a stricter pattern here would
 * mean re-learning this file the next time the id format changes.
 */
const CITATION = /^doc:([A-Za-z0-9_-]+)(?:\?page=(\d+))?$/;

/** Reads a citation href, or returns null for anything that is not one. */
export function parseCitation(href: string | undefined): ParsedCitation | null {
  if (!href) return null;

  const match = CITATION.exec(href.trim());
  if (!match) return null;

  const page = match[2] ? Number.parseInt(match[2], 10) : null;

  return {
    documentId: match[1],
    // A page of zero or a number that overflowed is worse than no page: it
    // would scroll the document somewhere arbitrary and look like the citation
    // was wrong about its own source.
    page: page !== null && Number.isSafeInteger(page) && page > 0 ? page : null,
  };
}

/** Whether an href is a citation at all — the renderer's first question. */
export function isCitationHref(href: string | undefined): boolean {
  return parseCitation(href) !== null;
}
