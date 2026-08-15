import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { MODIFIED_VALUES } from "@/lib/list-filters";

/**
 * The boards table's filters, as URL search params.
 *
 * The URL is the single source of truth: the toolbar reads and writes these
 * through `useQueryStates`, `useBoardsBrowser` puts the same values straight
 * into the `list` input, and `loadBoardFilters` parses them on the server so
 * the page can prefetch the *filtered* list rather than one the client would
 * immediately have to replace.
 *
 * Only "modified" — a board has no type to filter by. Kept in its own file
 * rather than shared with the drive's parsers so the two pages can grow apart
 * without one inheriting a filter the other invented.
 */
export const boardFilterParsers = {
  modified: parseAsStringLiteral(MODIFIED_VALUES),
};

/** Server-side reader for the above. Takes a page's `searchParams` promise. */
export const loadBoardFilters = createLoader(boardFilterParsers);
