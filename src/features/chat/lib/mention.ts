/**
 * The `@` token being typed in the composer, and how to finish it.
 *
 * Kept out of the component because it is the only part of the mention picker
 * with rules worth stating on their own: what counts as a mention, where it
 * starts, and what the box says once one has been chosen.
 */

/**
 * How long a token may run before it stops being a mention.
 *
 * An `@` is not always the start of one — email addresses, npm scopes, a stray
 * keystroke — and the honest signal is length: nobody types forty characters of
 * a file name without the list under them having already narrowed to it or
 * emptied. Past that the menu gets out of the way rather than following along.
 */
const MAX_QUERY = 40;

/**
 * `@` at the start of the text or after a space, then anything that is not a
 * space or another `@`, up to the caret. Anchored at the end because the only
 * mention that matters is the one being written *now*.
 */
const ACTIVE_MENTION = /(?:^|\s)@([^\s@]*)$/;

export interface ActiveMention {
  /** Index of the `@` itself. */
  start: number;
  /** What has been typed after it, which is what the list filters on. */
  query: string;
}

/** The mention the caret is sitting in, if it is sitting in one. */
export function findActiveMention(
  value: string,
  caret: number,
): ActiveMention | null {
  const match = ACTIVE_MENTION.exec(value.slice(0, caret));
  if (!match) return null;

  const query = match[1];
  if (query.length > MAX_QUERY) return null;

  return { start: caret - query.length - 1, query };
}

/**
 * The text with the half-typed token replaced by a file's name, and where the
 * caret belongs afterwards.
 *
 * A trailing space is added rather than left to the user, and it does two jobs:
 * it is what somebody would type next anyway, and it ends the token — with the
 * caret no longer inside a mention, the menu closes by the same rule that
 * opened it instead of needing to be told to.
 *
 * The name goes in as-is, spaces and all. Nothing here parses it back out; it
 * is read by the model, which already has the catalogue of the user's documents
 * in front of it and matches the name to the document — see `prompt.ts`.
 */
export function applyMention(
  value: string,
  mention: ActiveMention,
  name: string,
): { value: string; caret: number } {
  const before = value.slice(0, mention.start);
  const after = value.slice(mention.start + 1 + mention.query.length);
  const token = `@${name} `;

  return {
    value: `${before}${token}${after}`,
    caret: before.length + token.length,
  };
}

export interface MentionSegment {
  text: string;
  /** True for the `@Name` runs, which the composer paints behind the text. */
  isMention: boolean;
}

/**
 * The question, cut into what is a reference and what is prose.
 *
 * Driven by the names actually chosen from the menu rather than by the `@`
 * pattern, and that is the honest way round: `@` followed by a word is
 * something anybody might type, and colouring it in would claim a reference
 * that was never made. A name that has been picked is one this composer knows
 * points at a real file.
 *
 * It follows that editing a highlighted name un-highlights it — the text no
 * longer matches what was chosen. That is the right behaviour rather than a
 * limitation: the mark says "this names one of your files", so it has to stop
 * saying it the moment the words stop being that name.
 *
 * Longest first, so a file called "Notes" cannot claim the opening of a
 * mention of "Notes on Chapter 4".
 */
export function splitMentions(
  value: string,
  names: string[],
): MentionSegment[] {
  const ordered = [...new Set(names)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (ordered.length === 0) return [{ text: value, isMention: false }];

  const segments: MentionSegment[] = [];
  let plain = "";
  let index = 0;

  const flush = () => {
    if (!plain) return;
    segments.push({ text: plain, isMention: false });
    plain = "";
  };

  while (index < value.length) {
    // The same rule that opens the menu: an `@` starts a mention only at the
    // beginning of the text or after a space.
    const starts = index === 0 || /\s/.test(value[index - 1]);
    const name =
      value[index] === "@" && starts
        ? ordered.find((candidate) => value.startsWith(candidate, index + 1))
        : undefined;

    if (name) {
      flush();
      segments.push({ text: `@${name}`, isMention: true });
      index += name.length + 1;
      continue;
    }

    plain += value[index];
    index += 1;
  }

  flush();
  return segments;
}
