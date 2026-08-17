import { create } from "zustand";

/**
 * The question that was asked on the way to a new chat.
 *
 * The landing page has no conversation to send to — the chat does not exist
 * until something is said in it. Rather than create a row, wait for the id and
 * then navigate, the browser mints the id itself, stashes the question here and
 * routes immediately; the conversation page picks the question up on mount and
 * sends it. The user sees their words move to the top of a new page and the
 * answer start, with nothing in between.
 *
 * Deliberately not `sessionStorage` or a query parameter. A question in the URL
 * would be in the browser's history and shown in the address bar, and one in
 * storage would survive a reload and re-ask itself. This lives exactly as long
 * as the navigation does, which is the lifetime of the thing it describes.
 */
interface ChatDraftState {
  /** Keyed by chat id, so a second navigation cannot pick up the first's text. */
  drafts: Record<string, string>;
  stage: (chatId: string, question: string) => void;
  /**
   * Reads a staged question and forgets it in the same call.
   *
   * One function rather than a read and a clear, because the two must not be
   * separable: React runs effects twice in development, and a version that
   * returned the text without consuming it would ask the same question twice.
   */
  take: (chatId: string) => string | null;
}

export const useChatDraftStore = create<ChatDraftState>((set, get) => ({
  drafts: {},
  stage: (chatId, question) =>
    set((state) => ({ drafts: { ...state.drafts, [chatId]: question } })),
  take: (chatId) => {
    const question = get().drafts[chatId];
    if (question === undefined) return null;

    set((state) => {
      const rest = { ...state.drafts };
      delete rest[chatId];
      return { drafts: rest };
    });

    return question;
  },
}));
