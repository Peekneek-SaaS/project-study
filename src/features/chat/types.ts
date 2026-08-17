import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type ChatSummary = RouterOutputs["chat"]["list"][number];
export type ChatDetail = RouterOutputs["chat"]["get"];
export type DocumentChat = RouterOutputs["chat"]["forDocument"];
export type DocumentChatContent = NonNullable<DocumentChat["content"]>;

/**
 * The column everything in a chat is measured against.
 *
 * One constant, used by the transcript *and* the composer, because the failure
 * it prevents is them disagreeing: a box that stretches to the window while the
 * answers above it stay in a readable column looks broken on a wide monitor,
 * and it is the kind of thing that drifts the moment the two are written as
 * separate class strings on separate components.
 *
 * `max-w-3xl` is a measure, not a guess — roughly 90 characters at this size,
 * which is about the widest a paragraph stays comfortable to read.
 */
export const CHAT_COLUMN = "mx-auto w-full max-w-3xl";

/**
 * Where conversations live.
 *
 * The landing page is a route of its own rather than a chat with no id: it
 * shows a greeting and the recents list, which a conversation does not, and
 * having an address for "start something new" is what makes the sidebar link
 * mean anything.
 */
export const CHAT_PATH = "/chat";

export const chatPath = (chatId: string) => `${CHAT_PATH}/${chatId}`;

/**
 * A conversation's id, minted in the browser.
 *
 * The id is generated client-side so that asking the first question can route
 * and start streaming in the same tick — the alternative is a round trip to the
 * server to be told what to call the page, which is a visible pause at the
 * exact moment the app should feel fastest. The row is written server-side on
 * that first request, under this id.
 *
 * `randomUUID` rather than the cuid the database would have picked: the point
 * is only that two browsers never collide, and this is the one generator
 * available everywhere without a dependency.
 */
export function newChatId(): string {
  return crypto.randomUUID();
}

/**
 * A document's chat id, derived rather than looked up.
 *
 * A document has exactly one conversation, and the browser needs to name it
 * before it can open a stream — but on a document that has never been chatted
 * with there is no row yet to read an id from. Deriving it from the document
 * means both sides arrive at the same string with no round trip, and the row is
 * created under it on the first message.
 *
 * Only used for a chat that does not exist yet. Where one does, its real id
 * wins — chats created before this scheme have ordinary generated ids, and they
 * must keep answering to them.
 */
export const documentChatId = (documentId: string) => `doc-${documentId}`;

/**
 * Where a conversation's durable run had got to.
 *
 * Handed to the chat transport so a fresh tab reattaches to a turn already in
 * flight instead of starting a new one. `null` for a conversation with no run
 * behind it — one that has never been used, or whose run has since ended.
 */
export interface ChatSessionState {
  publicAccessToken: string;
  lastEventId: string | undefined;
}
