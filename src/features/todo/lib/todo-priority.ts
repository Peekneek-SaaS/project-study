/**
 * Priority, in the order it is offered and read.
 *
 * Urgent first, because a list of priorities is scanned for the top of it. The
 * values are the database enum's own names, so a priority survives the round
 * trip through the URL, the filter and the row without ever being translated —
 * `MODIFIED_FILTERS` works the same way for the shared "modified" filter.
 *
 * The colours are deliberately not the theme's `primary`: primary is what the
 * page uses to mean "this is yours to act on" — the add buttons, the today
 * marker, the calendar dots — and a priority that borrowed it would compete
 * with all of them at once.
 */
export const TODO_PRIORITIES = [
  {
    value: "URGENT",
    label: "Urgent",
    /** For the flag on a row, and the bar down the side of a card. */
    className: "text-red-500",
    dotClassName: "bg-red-500",
  },
  {
    value: "HIGH",
    label: "High",
    className: "text-orange-500",
    dotClassName: "bg-orange-500",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    className: "text-amber-500",
    dotClassName: "bg-amber-500",
  },
  {
    value: "LOW",
    label: "Low",
    className: "text-sky-500",
    dotClassName: "bg-sky-500",
  },
  {
    value: "NONE",
    label: "No priority",
    className: "text-muted-foreground",
    dotClassName: "bg-muted-foreground/40",
  },
] as const;

export type TodoPriority = (typeof TODO_PRIORITIES)[number]["value"];

/** Just the values, for `z.enum` and `parseAsStringLiteral`. */
export const TODO_PRIORITY_VALUES = TODO_PRIORITIES.map(
  (priority) => priority.value,
) as [TodoPriority, ...TodoPriority[]];

/** What a new todo is when nobody said. */
export const DEFAULT_PRIORITY: TodoPriority = "NONE";

export function priorityMeta(value: TodoPriority) {
  // The fallback cannot be reached through the type, but the value arrives from
  // a database column and this is the one place that would crash on a row
  // written before a future member was added here.
  return (
    TODO_PRIORITIES.find((priority) => priority.value === value) ??
    TODO_PRIORITIES[TODO_PRIORITIES.length - 1]
  );
}

/**
 * Sort order within a day: loudest first, and untouched otherwise.
 *
 * Returns a number rather than sorting, so the caller can keep it as a *tie*
 * break behind `position` — hand-ordering is the stronger statement, and a
 * sort that ignored it would move a row the user had just dragged.
 */
export function priorityRank(value: TodoPriority) {
  const index = TODO_PRIORITIES.findIndex(
    (priority) => priority.value === value,
  );
  return index === -1 ? TODO_PRIORITIES.length : index;
}
