/**
 * Where a piece of selected text can be sent.
 *
 * One list, so the picker, the store and every button that opens it agree on
 * what kinds exist. Adding a kind is this union plus a list component in
 * `paste-into-modal.tsx` — nothing else has to learn about it.
 *
 * The point of naming them rather than passing a callback around is that the
 * *intent* stays serializable: the store holds "put this text in a note", not a
 * closure over whatever component happened to be on screen when the selection
 * was made. Which matters here, because the selection's own component is gone
 * by the time the modal opens — the click that opened it cleared the selection.
 */
export const PASTE_TARGETS = [
  "notes",
  "todos",
  "boards",
  "chats",
  "documents",
] as const;

export type PasteTargetKind = (typeof PASTE_TARGETS)[number];

/** What the picker was opened to do. */
export interface PasteIntoTarget {
  kind: PasteTargetKind;
  /** The text to put into whatever is chosen. */
  text: string;
}

/** The picker's copy, per kind. */
export const PASTE_TARGET_COPY: Record<
  PasteTargetKind,
  {
    title: string;
    description: string;
    heading: string;
    /** Absent on a kind whose picker is not a search — see `todos`. */
    placeholder?: string;
  }
> = {
  notes: {
    title: "Write in a note",
    description: "Choose the note to add this text to.",
    placeholder: "Search your notes…",
    heading: "Notes",
  },
  todos: {
    title: "Make it a task",
    description: "Choose the day this task is due.",
    heading: "Tasks",
  },
  boards: {
    title: "Write on a board",
    description: "Choose the board to add this text to.",
    placeholder: "Search your boards…",
    heading: "Boards",
  },
  chats: {
    title: "Send to a chat",
    description: "Choose the conversation to send this text to.",
    placeholder: "Search your chats…",
    heading: "Chats",
  },
  documents: {
    title: "Attach to a document",
    description: "Choose the document to attach this text to.",
    placeholder: "Search your documents…",
    heading: "Documents",
  },
};
