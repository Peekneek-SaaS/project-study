import { format } from "date-fns";

/**
 * Timestamps arrive as ISO strings over the wire even though the router types
 * them as `Date` (no superjson transformer is configured), so normalise both.
 */
export function formatDriveDate(value: Date | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
}
