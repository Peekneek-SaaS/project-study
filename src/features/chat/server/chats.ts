/**
 * No `server-only` marker here, deliberately.
 *
 * This module is imported by the Trigger.dev worker as well as by Next. That
 * package resolves to a file that throws on import unless React's
 * `react-server` condition is set, which a plain Node bundle does not set — so
 * the marker would not restrict this module, it would break every task that
 * reaches it.
 *
 * Nothing is lost by dropping it: everything here touches Prisma or an API key,
 * and neither survives a client bundle quietly.
 */

import type { UIMessage } from "ai";

import type { AiProvider } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

/**
 * Where conversations are kept.
 *
 * Shared by the server action that opens a session, the chat agent that writes
 * turns, and the tRPC router that reads them back — so the rule that a document
 * has exactly one chat, and the rule for what a chat gets called, each exist
 * once rather than three times.
 */

/** How much of the first question becomes the chat's name. */
const TITLE_MAX = 60;

/**
 * A chat's title, taken from the first thing asked.
 *
 * Titles are derived rather than requested. A dialog asking for a name before
 * the user has said anything is a dialog in the way of the thing they came to
 * do, and the first question is almost always a better description than
 * anything they would have typed into it. Renaming later is one click.
 */
export function titleFromMessage(message: UIMessage | undefined): string | null {
  if (!message) return null;

  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;
  if (text.length <= TITLE_MAX) return text;

  // Cut at a word boundary where there is one close to the limit, so titles end
  // on a word rather than mid-syllable.
  const clipped = text.slice(0, TITLE_MAX);
  const space = clipped.lastIndexOf(" ");
  return `${space > TITLE_MAX * 0.6 ? clipped.slice(0, space) : clipped}…`;
}

/**
 * Finds or creates the chat a request belongs to.
 *
 * Universal chats are addressed by an id the *client* generated, which is what
 * makes asking the first question feel instantaneous: the browser routes to
 * `/chat/<id>` and starts streaming in the same tick, rather than waiting for a
 * round trip to learn what to call the page. The row is created here, on the
 * first message, so a chat that was opened and abandoned never becomes an empty
 * row in the recents list.
 *
 * Document chats are addressed by their document instead, because there is only
 * ever one — the `@unique` on `Chat.documentId` is what enforces that, and the
 * upsert is what makes concurrent first messages settle on the same row rather
 * than one of them failing on the constraint.
 */
export async function resolveChat({
  userId,
  chatId,
  documentId,
  provider,
  firstMessage,
}: {
  userId: string;
  /** The client-generated id, for a universal chat. */
  chatId?: string | null;
  /** The document, for a document-scoped chat. */
  documentId?: string | null;
  provider: AiProvider;
  /** Used to name a chat that does not have a name yet. */
  firstMessage?: UIMessage;
}): Promise<{ id: string; isNew: boolean }> {
  const title = titleFromMessage(firstMessage);

  if (documentId) {
    // Ownership is proven here rather than trusted from the request: this is
    // the only place a document chat is created, so it is the only place that
    // has to check, and a `documentId` the user does not own finds nothing.
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true, name: true },
    });
    if (!document) throw new Error("Document not found");

    const existing = await prisma.chat.findUnique({
      where: { documentId },
      select: { id: true },
    });

    if (existing) {
      await prisma.chat.update({
        where: { id: existing.id },
        data: { provider },
      });
      return { id: existing.id, isNew: false };
    }

    const created = await prisma.chat.create({
      data: {
        // The id the client proposed, kept rather than replaced.
        //
        // It matters that this is not a fresh cuid: the browser has already
        // opened a stream keyed by this id, and a row created under a different
        // one would leave the two talking past each other. `documentChatId`
        // derives it from the document, so both sides reach the same string
        // without a round trip — and the `@unique` on `documentId` below is
        // still what guarantees there is only ever one.
        ...(chatId ? { id: chatId } : {}),
        userId,
        scope: "DOCUMENT",
        documentId,
        // Named after the document rather than the first question: this chat is
        // a fixture of the document's page, not something the user started, and
        // it reads better in a list as the document's name.
        title: document.name,
        provider,
      },
      select: { id: true },
    });

    return { id: created.id, isNew: true };
  }

  if (!chatId) throw new Error("A chat id is required");

  const existing = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true, title: true },
  });

  if (existing) {
    await prisma.chat.update({
      where: { id: existing.id },
      data: {
        provider,
        // Only ever names a chat that has not been named. A user who renamed
        // one keeps their name, and a second question never overwrites the
        // title the first one gave it.
        ...(existing.title === "New chat" && title ? { title } : {}),
      },
    });
    return { id: existing.id, isNew: false };
  }

  const created = await prisma.chat.create({
    data: {
      // The client's id, kept rather than replaced — the browser is already at
      // this address.
      id: chatId,
      userId,
      scope: "UNIVERSAL",
      title: title ?? "New chat",
      provider,
    },
    select: { id: true },
  });

  return { id: created.id, isNew: true };
}

/**
 * Writes one message down.
 *
 * `upsert` on the SDK's own message id rather than a create, so the two ways a
 * message can arrive twice both settle rather than throw: a regenerated answer
 * replaces the one it is regenerating, and a retried request re-saves the
 * question it already saved.
 *
 * `parts` is stored whole. What the model searched and what it cited are part
 * of the answer — a reopened chat that had lost them would be a different
 * conversation from the one that was left.
 */
export async function saveMessage({
  chatId,
  message,
  provider,
}: {
  chatId: string;
  message: UIMessage;
  provider?: AiProvider | string | null;
}) {
  const parts = message.parts as object;

  await prisma.chatMessage.upsert({
    where: { id: message.id },
    create: {
      id: message.id,
      chatId,
      role: message.role,
      parts,
      provider: provider ?? null,
    },
    update: { parts, provider: provider ?? null },
  });

  // Touched so the recents list orders by when a chat was last spoken to. Not
  // done by the message insert on its own — `updatedAt` belongs to the chat row,
  // and nothing else writes to it during a conversation.
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });
}
