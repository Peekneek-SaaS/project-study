/**
 * A note's text is one string, and its first line is its name.
 *
 * Stored as one column rather than as a title and a body, because that is what
 * it is: a sticky note is written top to bottom, and the first thing written on
 * it is what it ends up being called. The card renders that line in its own
 * field so it can be bold; these functions are the seam between the two views
 * of the same string, and search reads the name through the same ones.
 */

/** What to call a note whose first line is still empty. */
export const UNTITLED_NOTE = "Untitled note";

/**
 * The first line, exactly as typed.
 *
 * Untrimmed on purpose — this is what the title field is set to on every
 * keystroke, and trimming here would eat a space the moment it was typed.
 */
export function noteTitleLine(content: string) {
  const index = content.indexOf("\n");
  return index === -1 ? content : content.slice(0, index);
}

/** Everything after the first line. */
export function noteBody(content: string) {
  const index = content.indexOf("\n");
  return index === -1 ? "" : content.slice(index + 1);
}

/**
 * Puts the two back together.
 *
 * The newline only appears once there is a body to separate — otherwise every
 * untouched note would be stored as a stray line break.
 */
export function joinNote(title: string, body: string) {
  return body ? `${title}\n${body}` : title;
}

/** The name to show for a note — trimmed, and never empty. */
export function noteDisplayTitle(content: string) {
  return noteTitleLine(content).trim() || UNTITLED_NOTE;
}
