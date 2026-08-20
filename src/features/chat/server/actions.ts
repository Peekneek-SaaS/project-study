"use server";

import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";

import { resolveChat } from "@/features/chat/server/chats";
import { coerceProvider } from "@/lib/ai/providers";
import { prisma } from "@/lib/prisma";

/**
 * The two things the browser cannot do for itself.
 *
 * With the answering moved into a Trigger.dev run there is no API route left to
 * authorise a chat — the transport talks to Trigger.dev directly. These actions
 * are what stands in its place: they run on this server, they are the only code
 * holding the environment secret key, and they are where "is this yours?" is
 * asked.
 *
 * Both are written on the assumption that `chatId` is attacker-controlled,
 * because it is: it is a string the browser chose. Neither trusts it for
 * anything more than a lookup, and both refuse before minting a credential for
 * a chat the caller does not own.
 */

/** The raw session starter. Wrapped below rather than exported directly. */
const startSession = chat.createStartSessionAction("study-chat");

/**
 * Opens a conversation's durable run, creating the chat if this is its first
 * message.
 *
 * The wrapping is the security boundary. `chat.createStartSessionAction` will
 * happily start a session for any id it is handed; this decides *whether it
 * should*, and writes the `Chat` row — with the authenticated owner and the
 * document it is allowed to read — before the run exists. That ordering is what
 * lets the agent look its scope up rather than being told it: by the time a
 * turn runs, the row is already there and already says who it belongs to.
 */
export async function startStudyChatSession({
  chatId,
  documentId,
  provider,
  clientData,
}: {
  chatId: string;
  /** Set for a document's own chat; absent for a universal one. */
  documentId?: string | null;
  provider?: string | null;
  clientData?: unknown;
}) {
  const { userId } = await clerkAuth();
  if (!userId) throw new Error("Unauthorized");

  // Creates the row on a first message, and confirms ownership on every one
  // after — a `chatId` belonging to someone else throws rather than being
  // adopted. For a document chat this also proves the document is the caller's.
  const resolved = await resolveChat({
    userId,
    chatId,
    documentId,
    provider: coerceProvider(provider),
  });

  return startSession({ chatId: resolved.id, clientData });
}

/**
 * Mints the short-lived token the browser reconnects with.
 *
 * Called by the transport whenever its token is rejected as expired, which
 * makes this the one action that runs unprompted — so the ownership check
 * matters more here than anywhere. Without it, knowing a chat id would be
 * enough to be handed read and write access to that conversation's stream.
 *
 * Scoped to a single session in both directions, and short-lived, so a leaked
 * token is worth one chat for one hour rather than an account.
 */
export async function mintChatAccessToken(chatId: string) {
  const { userId } = await clerkAuth();
  if (!userId) throw new Error("Unauthorized");

  const owned = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");

  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  });
}

/**
 * Forgets a conversation's stream position once its run has ended.
 *
 * The transport reports this; without it, the next visit would try to resume
 * from a cursor into a stream that no longer exists and wait on a subscription
 * that never delivers. The messages are untouched — this clears where to *watch*
 * from, not what was said.
 */
export async function clearChatSession(chatId: string) {
  const { userId } = await clerkAuth();
  if (!userId) return;

  await prisma.chat.updateMany({
    where: { id: chatId, userId },
    data: {
      sessionRunId: null,
      sessionToken: null,
      lastEventId: null,
      // Belt and braces for the one case the run cannot report: a worker that
      // died mid-turn never reaches `onTurnComplete`, so the flag would stay
      // set and every later visit would wait on a stream nobody is writing.
      isStreaming: false,
    },
  });
}
