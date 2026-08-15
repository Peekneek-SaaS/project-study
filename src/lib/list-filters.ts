/**
 * "Modified" as a filter, for any list of things that record when they changed.
 *
 * Shared rather than owned by one page: the drive and the boards table offer
 * the same choices and mean the same thing by them, and a router that took
 * "last7days" from one and something else from the other would be two features
 * pretending to be one. The type filter stays with the drive — only files have
 * a kind — see `features/main/lib/drive-filters`.
 */

export const MODIFIED_FILTERS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 days" },
] as const;

export type ModifiedFilter = (typeof MODIFIED_FILTERS)[number]["value"];

/** Just the values, for `z.enum` and `parseAsStringLiteral`. */
export const MODIFIED_VALUES = MODIFIED_FILTERS.map(
  (filter) => filter.value,
) as [ModifiedFilter, ...ModifiedFilter[]];

/**
 * A `modified` filter as a Prisma range on `updatedAt`, or `undefined` for no
 * filter at all.
 *
 * Day boundaries are the *server's*, since that is where this runs and the
 * request carries no timezone. Near midnight a user several zones away can see
 * a row land under the neighbouring day; the alternative — the client sending
 * computed instants — makes every query key timezone-shaped and misses the
 * server-rendered prefetch, which is a worse trade for a listing.
 */
export function modifiedRange(filter: ModifiedFilter | null) {
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
