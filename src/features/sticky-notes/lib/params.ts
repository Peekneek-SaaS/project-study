import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { MODIFIED_VALUES } from "@/lib/list-filters";

/**
 * The notes wall's filters, as URL search params.
 *
 * The URL is the single source of truth: the toolbar reads and writes this
 * through `useQueryStates`, `useNotesBrowser` puts the same value straight into
 * the `list` input, and `loadNoteFilters` parses it on the server so the page
 * can prefetch the *filtered* wall rather than one the client would immediately
 * have to replace.
 *
 * Deliberately separate from `NOTE_TARGET_PARAM`, which also lives in this
 * page's query string: that one is a one-shot instruction the grid consumes and
 * strips, and this one is state meant to stick around.
 */
export const noteFilterParsers = {
  modified: parseAsStringLiteral(MODIFIED_VALUES),
};

/** Server-side reader for the above. Takes a page's `searchParams` promise. */
export const loadNoteFilters = createLoader(noteFilterParsers);
