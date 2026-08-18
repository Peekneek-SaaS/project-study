import { format, isToday, isYesterday } from "date-fns";

/**
 * When a message was sent, written the way someone would say it.
 *
 * Relative for the two days that have names and absolute after that, because
 * that is how the date is actually used here: in a conversation held this
 * afternoon the date is noise and the time is the whole point, while in one
 * reopened weeks later the time alone tells you nothing.
 *
 * Timestamps arrive as ISO strings even though the router types them as `Date`
 * — there is no transformer on the tRPC client — so both are accepted, the same
 * way `formatDriveDate` handles it.
 */
export function formatMessageTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const time = format(date, "h:mm a");

  if (isToday(date)) return `Today at ${time}`;
  if (isYesterday(date)) return `Yesterday at ${time}`;

  // The year is dropped within the current year and kept outside it: "Aug 17"
  // is unambiguous in a conversation from this year and misleading in one from
  // the last.
  const day =
    date.getFullYear() === new Date().getFullYear()
      ? format(date, "MMM d")
      : format(date, "MMM d, yyyy");

  return `${day} at ${time}`;
}
