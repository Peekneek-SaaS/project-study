/**
 * Plan refusals, in a form the browser can act on.
 *
 * A refusal has to do two things at once: tell a person what happened, in a
 * sentence written for them, and tell the UI *which* limit was hit so it can
 * open the offer that fixes it. Prose alone cannot do the second — matching on
 * the words of a message means the paywall silently stops opening the day
 * somebody rewords it — so every plan error carries a short machine tag on the
 * end, and the client strips it before anything is shown.
 *
 * The tag only travels over channels this app controls end to end: the upload
 * route's error, the chat run's abort message, and tRPC. Anywhere a message is
 * *stored* rather than thrown — the failure note on a document, say — it is
 * cleaned first, so a tag can never end up in the database or on a screen.
 */

/** The limits a refusal can be about. Each maps to a gate in `use-paywall`. */
export const PLAN_ERROR_FEATURES = [
  "credits",
  "documents",
  "pages",
  "ocr",
  "providerPicker",
] as const;

export type PlanErrorFeature = (typeof PLAN_ERROR_FEATURES)[number];

/**
 * The tag, and the pattern that finds it.
 *
 * Anchored to the end and written with a character class rather than
 * interpolation, so a message that happens to contain the word "plan" in
 * brackets cannot be mistaken for one.
 */
const TAG = /\s*\[plan:(credits|documents|pages|ocr|providerPicker)\]$/;

/** Adds the tag. Called wherever a plan refusal is constructed, and nowhere else. */
export function tagPlanError(
  message: string,
  feature: PlanErrorFeature,
): string {
  return `${message} [plan:${feature}]`;
}

/** The message as a person should read it, tag removed. Safe on any string. */
export function cleanPlanError(message: string): string {
  return message.replace(TAG, "").trim();
}

/**
 * What a failure was about, if it was about a plan at all.
 *
 * Takes anything — an `Error`, a tRPC failure, an UploadThing error, a bare
 * string — because it sits on the error paths of four different libraries and
 * each of them hands back a slightly different shape. Returns null for
 * everything that is not a plan refusal, which is most failures.
 */
export function parsePlanError(
  error: unknown,
): { feature: PlanErrorFeature; message: string } | null {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : null;

  if (!message) return null;

  const match = TAG.exec(message);
  if (!match) return null;

  return {
    feature: match[1] as PlanErrorFeature,
    message: cleanPlanError(message),
  };
}
