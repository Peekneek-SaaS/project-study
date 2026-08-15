/**
 * The drive's filter vocabulary.
 *
 * Deliberately dependency-free: the tRPC router validates against these values
 * and turns them into `where` clauses, the toolbar renders them as options, and
 * `lib/params.ts` builds the URL parsers from them. One list, so a filter the
 * toolbar offers is always one the server knows how to apply.
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

export const DRIVE_MODIFIED_FILTERS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 days" },
] as const;

export type DriveTypeFilter = (typeof DRIVE_TYPE_FILTERS)[number]["value"];
export type DriveModifiedFilter =
  (typeof DRIVE_MODIFIED_FILTERS)[number]["value"];

/** Just the values, for `z.enum` and `parseAsStringLiteral`. */
export const DRIVE_TYPE_VALUES = DRIVE_TYPE_FILTERS.map(
  (filter) => filter.value,
) as [DriveTypeFilter, ...DriveTypeFilter[]];

export const DRIVE_MODIFIED_VALUES = DRIVE_MODIFIED_FILTERS.map(
  (filter) => filter.value,
) as [DriveModifiedFilter, ...DriveModifiedFilter[]];

/** What a document's name has to end in to count as this kind. */
export function typeExtensions(filter: DriveTypeFilter) {
  return DRIVE_TYPE_FILTERS.find((entry) => entry.value === filter)!.extensions;
}

/**
 * A `modified` filter as a Prisma range on `updatedAt`, or `undefined` for no
 * filter at all.
 *
 * Day boundaries are the *server's*, since that is where this runs and the
 * request carries no timezone. Near midnight a user several zones away can see
 * a file land under the neighbouring day; the alternative — the client sending
 * computed instants — makes every query key timezone-shaped and misses the
 * server-rendered prefetch, which is a worse trade for the drive.
 */
export function modifiedRange(filter: DriveModifiedFilter | null) {
  if (!filter) return undefined;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const daysBack = (days: number) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() - days);
    return date;
  };

  switch (filter) {
    case "today":
      return { gte: startOfToday };
    case "yesterday":
      // Bounded on both ends — "yesterday" is a day, not everything since it.
      return { gte: daysBack(1), lt: startOfToday };
    case "last7days":
      // Six days back plus today, so the range is seven days including this one.
      return { gte: daysBack(6) };
  }
}
