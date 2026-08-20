/**
 * What a support request can be about.
 *
 * Lives outside both the modal and the router because all three sides need the
 * same list and none of them owns it: the form renders the labels, the router
 * validates against the values, and the email prints the label and paints its
 * badge with the accent. Adding a topic here adds it everywhere.
 */
export interface SupportTopic {
  value: string;
  /** Shown in the picker, in the subject line, and as the email's headline. */
  label: string;
  /** The one-line hint under the picker. */
  description: string;
  /**
   * Hex, not a theme token, because the email carries this. Mail clients do not
   * resolve CSS variables and most still choke on `oklch()`, so the palette in
   * `globals.css` is converted once — here — rather than at render time.
   */
  accent: string;
}

export const SUPPORT_TOPICS = [
  {
    value: "bug",
    label: "Bug report",
    description: "Something is broken or not behaving the way it should.",
    accent: "#D10001",
  },
  {
    value: "feature",
    label: "Feature request",
    description: "An idea for something StudyAI does not do yet.",
    accent: "#00B59B",
  },
  {
    value: "question",
    label: "Question",
    description: "You are not sure how something is meant to work.",
    accent: "#719D68",
  },
  {
    value: "billing",
    label: "Billing",
    description: "Plans, invoices, or anything to do with payment.",
    accent: "#FFB900",
  },
  {
    value: "other",
    label: "Something else",
    description: "Anything that does not fit the boxes above.",
    accent: "#565552",
  },
] as const satisfies readonly SupportTopic[];

export type SupportTopicValue = (typeof SUPPORT_TOPICS)[number]["value"];

export const SUPPORT_TOPIC_VALUES = SUPPORT_TOPICS.map(
  (topic) => topic.value,
) as [SupportTopicValue, ...SupportTopicValue[]];

export const DEFAULT_SUPPORT_TOPIC: SupportTopicValue = "bug";

/**
 * Falls back rather than returning `undefined`: every caller here is rendering
 * something and has no sensible way to render "no topic", and the value has
 * already been through `z.enum` by the time the email sees it.
 */
export const findSupportTopic = (value: string): SupportTopic =>
  SUPPORT_TOPICS.find((topic) => topic.value === value) ?? SUPPORT_TOPICS[0];

/** Kept in step with the router's schema — the form counts against it too. */
export const MAX_SUPPORT_NAME = 80;
export const MAX_SUPPORT_MESSAGE = 4000;
