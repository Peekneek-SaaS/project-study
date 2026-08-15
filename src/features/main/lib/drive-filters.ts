/**
 * The drive's type filter.
 *
 * Deliberately dependency-free: the tRPC router validates against these values
 * and turns them into `where` clauses, the toolbar renders them as options, and
 * `lib/params.ts` builds the URL parsers from them. One list, so a filter the
 * toolbar offers is always one the server knows how to apply.
 *
 * The "modified" filter used to live here too and now sits in
 * `@/lib/list-filters`, because the boards table offers the same one. A file's
 * *type* has no counterpart there, so it stays.
 */

/**
 * Document kinds, and the extensions each stands for.
 *
 * Extension rather than MIME type because that is all a document row records —
 * `Document` has a `name` and no content type, and `isPdf`/`isSlides` read the
 * same suffix everywhere else a file is drawn.
 */
export const DRIVE_TYPE_FILTERS = [
  { value: "pdf", label: "PDF", extensions: [".pdf"] },
  { value: "docs", label: "Word", extensions: [".doc", ".docx"] },
  { value: "slides", label: "PowerPoint", extensions: [".ppt", ".pptx"] },
] as const;

export type DriveTypeFilter = (typeof DRIVE_TYPE_FILTERS)[number]["value"];

/** Just the values, for `z.enum` and `parseAsStringLiteral`. */
export const DRIVE_TYPE_VALUES = DRIVE_TYPE_FILTERS.map(
  (filter) => filter.value,
) as [DriveTypeFilter, ...DriveTypeFilter[]];

/** What a document's name has to end in to count as this kind. */
export function typeExtensions(filter: DriveTypeFilter) {
  return DRIVE_TYPE_FILTERS.find((entry) => entry.value === filter)!.extensions;
}
