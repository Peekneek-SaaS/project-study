import { AbortTaskRunError, logger } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText } from "ai";
import z from "zod";

import { saveMessage, titleFromMessage } from "@/features/chat/server/chats";
import {
  documentSystemPrompt,
  universalSystemPrompt,
  type PromptOptions,
} from "@/features/chat/server/prompt";
import { chatTools } from "@/features/chat/server/tools";
import {
  chatCredits,
  getEntitlements,
  InsufficientCreditsError,
  modelTierFor,
  recordUsage,
  refundCredits,
  spendCredits,
} from "@/features/billing/server/entitlements";
import { createFallbackModel } from "@/lib/ai/providers";
import { listReadableDocuments, readDocumentDigest } from "@/lib/ai/retrieval";
import { readWorkspaceSnapshot } from "@/lib/ai/workspace";
import { AI_PROVIDERS, DEFAULT_CITATIONS, type AiProvider } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

/**
 * Answering, as a background job rather than as a request.
 *
 * The whole conversation is one long-lived Trigger.dev run: it wakes when a
 * message arrives, freezes when none do, and keeps going regardless of what the
 * browser is doing. That is the point. Answering inside an HTTP handler ties the
 * work to the connection — close the tab, lose signal, or navigate to another
 * page and the answer either dies or finishes somewhere nobody can watch. Here
 * the user can ask a long question, go and read a document, and come back to
 * find the answer either still streaming or already waiting.
 *
 * There is no `/api/chat` route any more. The browser talks to this run through
 * `useTriggerChatTransport`, which reconnects with a stream cursor rather than
 * re-requesting, so returning to a page mid-answer resumes exactly where the
 * user left off instead of replaying from the top.
 *
 * What the client is trusted with, and what it is not:
 *
 *   - `provider` comes from the request. It only selects which model answers,
 *     so the worst a forged value can do is pick a different voice.
 *   - `cite` comes from the request too, and is just as harmless: it chooses
 *     between two sets of writing rules. Neither set relaxes the requirement to
 *     search before answering, so a forged value cannot talk the model out of
 *     using the documents — only out of linking to them.
 *   - *Which documents may be read* never comes from the request. It is looked
 *     up here from the `Chat` row, which was written server-side by an
 *     authenticated action. A client cannot widen its own scope by asking,
 *     because there is nothing in the payload to widen.
 *   - *What the account may spend* never comes from the request either. The
 *     plan, the balance and the model tier are read from `BillingAccount` at
 *     the start of every turn. A forged `provider` on a free plan is dropped
 *     rather than honoured, which is what stops the picker being a way to buy
 *     the expensive models for nothing.
 */

/**
 * How many times the model may search before it has to answer.
 *
 * Each step is one round trip: a search, a page read, or the answer itself.
 * Eight covers the compound questions this exists for — find the chapter, read
 * it, check a second document, answer — and stops a model looping fruitlessly.
 *
 * It is also the single biggest lever on what one answer costs, because every
 * step re-sends everything before it: the eighth step of a turn carries seven
 * steps of tool results with it. So the ceiling is per plan — see
 * `plan.maxSteps` — and eight is what the plan that pays for it gets.
 */
const MAX_STEPS_CEILING = 8;

/** Everything the browser is allowed to say about a turn. */
const clientDataSchema = z.object({
  provider: z.enum(AI_PROVIDERS).nullish(),
  /**
   * Whether this turn should cite its sources. Absent means `DEFAULT_CITATIONS`.
   *
   * Sent per turn rather than stored on the chat, because it is a preference
   * about the reader rather than a property of the conversation: the same
   * transcript can hold cited answers from before it was switched off and
   * plain ones from after, which is exactly what the user asked for when they
   * flipped it mid-chat.
   */
  cite: z.boolean().nullish(),
});

/**
 * Who a chat belongs to and what it may read.
 *
 * Resolved from the database by `chatId`, never from the payload — see the note
 * above. Cached per worker process because it cannot change for the life of a
 * chat: the owner and the document are fixed when the row is created.
 */
interface ChatScope {
  userId: string;
  documentId: string | null;
}

const scopeCache = new Map<string, ChatScope>();

/**
 * Which provider actually answered the turn just finished.
 *
 * Read in `onTurnComplete` and set in `run`, because the two need to agree and
 * only one of them can know: the picker says where the chain *starts*, and the
 * chain may have fallen through to the second or third model without anyone
 * noticing. `resolved()` reports what really spoke, but only after the stream
 * has been accepted — which has happened by the time the turn completes.
 *
 * Keyed by chat rather than held in a single variable: a worker is normally
 * dedicated to one chat, and "normally" is not a thing to write a mislabelled
 * transcript on.
 */
const answeredBy = new Map<string, () => AiProvider | null>();

/**
 * What this turn was charged, and what it actually used.
 *
 * Keyed by chat for the same reason `answeredBy` is: `run` knows what was
 * debited, `onTurnComplete` knows whether the answer arrived and what it cost
 * in tokens, and the two hooks cannot pass anything to each other directly.
 *
 * The token counts are the reason this exists at all. Credits are a guess about
 * what an answer costs until there are a few thousand of these rows to compare
 * them against; recording usage alongside the charge is what turns the pricing
 * table from an assumption into something measured.
 */
interface TurnCharge {
  credits: number;
  kind: "CHAT_FAST" | "CHAT_FRONTIER";
  usage: () => { inputTokens?: number; outputTokens?: number } | null;
}

const turnCharges = new Map<string, TurnCharge>();

async function scopeFor(chatId: string): Promise<ChatScope> {
  const cached = scopeCache.get(chatId);
  if (cached) return cached;

  const row = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { userId: true, documentId: true },
  });

  // The row is written by the server action before the session is ever started,
  // so its absence means the chat was deleted mid-flight. Nothing to answer for
  // and nothing a retry would fix.
  if (!row) {
    throw new AbortTaskRunError(`Chat ${chatId} no longer exists.`);
  }

  scopeCache.set(chatId, row);
  return row;
}

/**
 * What this turn's model is told about the documents it can see, and about the
 * work the user has done on them.
 *
 * Rebuilt per turn rather than once per chat, deliberately: a document finishes
 * processing while a conversation is open often enough to matter, and a chat
 * that could not see the upload you just made would look broken. The same
 * argument applies twice over to the workspace — notes and todos are written
 * *during* a conversation, and often because of one. Ask the assistant what to
 * revise, file the todo it suggests, ask it what is left: the second answer has
 * to know about the todo the first one caused.
 *
 * Two reads rather than one, run together. They touch different tables and
 * neither depends on the other, so the turn waits for the slower rather than
 * for the sum.
 */
async function systemPromptFor(
  scope: ChatScope,
  options: PromptOptions,
): Promise<string> {
  if (scope.documentId) {
    const [digest, workspace] = await Promise.all([
      readDocumentDigest(scope.userId, scope.documentId),
      readWorkspaceSnapshot({
        userId: scope.userId,
        documentId: scope.documentId,
      }),
    ]);

    // Processing has not finished, or failed. The panel guards this too, but a
    // session already open when the document was still being read would arrive
    // here with nothing to search.
    if (!digest) {
      return (
        "You are the study assistant for one document, but that document has " +
        "not finished being read yet, so you cannot search it. Say so briefly " +
        "and suggest they try again in a moment. Do not answer questions about " +
        "its contents from general knowledge."
      );
    }

    return documentSystemPrompt(digest, workspace, options);
  }

  const [digests, workspace] = await Promise.all([
    listReadableDocuments(scope.userId),
    // No `documentId`, so this is every board, note, annotation and todo the
    // user owns — the ones filed against a document and the loose ones alike.
    readWorkspaceSnapshot({ userId: scope.userId }),
  ]);

  return universalSystemPrompt(digests, workspace, options);
}

/**
 * Removes an answer that a retry threw away.
 *
 * `regenerate` drops the last answer on the client and the agent pops it from
 * its own history, but neither of them touches the database — so without this
 * the discarded answer stays in `ChatMessage`, and reopening the chat shows the
 * old reply *and* its replacement stacked one after the other. The new message
 * carries a new id, so the upsert in `saveMessage` cannot overwrite it either.
 *
 * Scoped deliberately tightly. It deletes only assistant rows, and only those
 * at or after the newest surviving question — which is exactly the tail a
 * regenerate can discard, because the agent trims trailing assistants and
 * stops at the first user message. A blunter "delete anything not in the
 * accumulated history" would do the same job today and quietly delete the front
 * of the transcript the day history compaction is turned on.
 */
async function reconcileRetriedAnswers(
  chatId: string,
  uiMessages: { id: string; role: string }[],
) {
  const keptIds = uiMessages.map((message) => message.id);
  if (keptIds.length === 0) return;

  // The boundary: nothing before the last question can be affected by a retry.
  const lastQuestion = await prisma.chatMessage.findFirst({
    where: { chatId, role: "user", id: { in: keptIds } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastQuestion) return;

  const { count } = await prisma.chatMessage.deleteMany({
    where: {
      chatId,
      role: "assistant",
      createdAt: { gte: lastQuestion.createdAt },
      id: { notIn: keptIds },
    },
  });

  if (count > 0) logger.log("Discarded retried answers", { chatId, count });
}

export const studyChat = chat
  .withClientData({ schema: clientDataSchema })
  .agent({
    id: "study-chat",

    /**
     * Declared here as well as handed to `streamText` below.
     *
     * The resolver runs per turn and is what scopes retrieval: `chatTools`
     * closes over the owner and the document, so there is no parameter in which
     * the model could name someone else's. Declaring the set on the agent too —
     * rather than only at the call site — is what keeps each tool's output
     * shape understood when history is re-converted on later turns.
     */
    tools: async ({ chatId }) => {
      const scope = await scopeFor(chatId);
      return chatTools({ userId: scope.userId, documentId: scope.documentId });
    },

    /**
     * Says, in the database, that an answer is being written right now.
     *
     * The counterpart to the flag cleared in `onTurnComplete`, and the reason
     * both edges are here rather than in the browser: a turn outlives the tab
     * that asked for it, so the only place that can honestly report "still
     * going" is the run doing the going.
     *
     * The token and the run id are written now as well as at the end. They used
     * to be recorded only on completion, which left the whole of the first
     * answer with no session for a reload to attach to — refreshing mid-answer
     * showed a question with nothing arriving under it, and the reply appeared
     * only after a later refetch. `lastEventId` is deliberately not touched:
     * there is no cursor yet this turn, and writing a null over the last one
     * would send the next reconnect back to the start of the stream.
     */
    onTurnStart: async ({ chatId, runId, chatAccessToken }) => {
      await prisma.chat.updateMany({
        where: { id: chatId },
        data: {
          isStreaming: true,
          sessionRunId: runId,
          sessionToken: chatAccessToken,
        },
      });
    },

    run: async ({ messages, tools, signal, chatId, clientData }) => {
      const scope = await scopeFor(chatId);

      /*
        What this account may do, read fresh on every turn.

        Not cached beside the scope: the scope is fixed for the life of a chat,
        whereas the balance changes with every answer and the plan can change
        mid-conversation — somebody who runs out, upgrades in another tab and
        comes back should not have to start a new chat to be believed.
      */
      const entitlements = await getEntitlements(scope.userId);

      /*
        The picker is a paid feature, and this is where that is enforced.

        A free client can still send `provider` — it is user input, and the
        component is only hidden rather than made impossible — so the value is
        dropped here rather than trusted. Dropping it also drops the frontier
        tier, because on plans without the picker the two are the same thing.
      */
      const requested = entitlements.plan.providerPicker
        ? (clientData?.provider ?? null)
        : null;

      const modelTier = modelTierFor(entitlements, requested);
      const credits = chatCredits(modelTier);

      /*
        Charged before a token is generated, refunded if nothing arrives.

        The order matters. Charging afterwards means an account can be taken to
        minus fifty by fifty questions asked in parallel, because each of them
        checks a balance that none of them has yet spent. Charging first makes
        the balance the queue.

        An empty balance is a finished answer, not a failure to retry — it will
        still be empty a second later, and the default policy would otherwise
        spend three attempts discovering that. `AbortTaskRunError` ends the run
        without retrying and carries the message through to the browser, so the
        user reads why their answer did not arrive rather than watching a chat
        that silently does nothing.
      */
      try {
        await spendCredits({ userId: scope.userId, credits });
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          logger.warn("Turn refused: out of credits", {
            chatId,
            userId: scope.userId,
            required: error.required,
            remaining: error.remaining,
          });
          throw new AbortTaskRunError(error.message);
        }
        throw error;
      }

      // The shared default rather than a literal, so a turn that arrives with
      // no flag on it — an older client, a session resumed from before the
      // toggle existed — answers the way a fresh chat in the browser would.
      const system = await systemPromptFor(scope, {
        cite: clientData?.cite ?? DEFAULT_CITATIONS,
      });

      const fallback = createFallbackModel(
        modelTier === "frontier" ? "chat" : "chat-fast",
        requested,
      );

      let usage: { inputTokens?: number; outputTokens?: number } | null = null;
      turnCharges.set(chatId, {
        credits,
        kind: modelTier === "frontier" ? "CHAT_FRONTIER" : "CHAT_FAST",
        usage: () => usage,
      });

      // Registered before the stream starts, read after it finishes — see
      // `answeredBy`. A getter rather than a value, because which provider
      // spoke is not decided yet at this point in the turn.
      answeredBy.set(chatId, () => fallback.resolved()?.provider ?? null);

      return streamText({
        // Spread first, so everything named after it wins. This is what wires
        // the system prompt, compaction and steering — without it they go
        // quietly missing rather than failing loudly.
        ...chat.toStreamTextOptions({ tools }),
        model: fallback.model,
        // `instructions`, not `system`: the SDK deprecated the older name in
        // v7 and it is slated for removal. Same prompt, current spelling.
        instructions: system,
        messages,
        // Load-bearing for the stop button: without it, stopping updates the UI
        // while the model carries on generating — and being a background job,
        // it would carry on to the end and bill for all of it.
        abortSignal: signal,
        // The plan's ceiling, never above the hard one. `Math.min` rather than
        // trusting the catalogue, so a typo in a plan cannot buy an account a
        // twenty-step answer.
        stopWhen: stepCountIs(
          Math.min(entitlements.plan.maxSteps, MAX_STEPS_CEILING),
        ),
        // What the turn actually cost, captured for the ledger. Totals across
        // every step, which is the number worth comparing a credit against.
        onFinish: ({ totalUsage }) => {
          usage = {
            inputTokens: totalUsage?.inputTokens,
            outputTokens: totalUsage?.outputTokens,
          };
        },
        onError: ({ error }) => {
          // By the time this fires the fallback chain has been walked and every
          // provider has refused, so it is a real outage worth logging.
          logger.error("Chat turn failed", { chatId, error });
        },
      });
    },

    /**
     * Writes the turn down.
     *
     * The only place messages are persisted, and it runs inside the durable run
     * rather than in a request — which is what makes "the user closed the tab"
     * a non-event. The answer is stored whether or not anyone is still watching.
     *
     * `newUIMessages` rather than the full `uiMessages`: the accumulated history
     * is rewritten on every turn, and re-saving all of it each time would grow
     * quadratically for no gain. Only this turn's messages are new.
     */
    onTurnComplete: async ({
      chatId,
      uiMessages,
      newUIMessages,
      runId,
      chatAccessToken,
      lastEventId,
      stopped,
    }) => {
      const scope = await scopeFor(chatId);
      const provider = answeredBy.get(chatId)?.() ?? null;

      /*
        Settling the turn: either it produced an answer, or the money goes back.

        An assistant message with no parts is the shape of a turn that produced
        nothing — the user pressed stop before the first token, or every
        provider in the chain refused. Both are turns nobody should pay for,
        and both are common enough that not handling them would show up as
        complaints rather than as a rounding error.

        Read and cleared in one go, so a worker serving the same chat again
        cannot settle this turn twice.
      */
      const charge = turnCharges.get(chatId);
      turnCharges.delete(chatId);

      const answered = newUIMessages.some(
        (message) => message.role === "assistant" && message.parts.length > 0,
      );

      if (charge) {
        if (answered) {
          const usage = charge.usage();
          await recordUsage({
            userId: scope.userId,
            kind: charge.kind,
            credits: charge.credits,
            provider,
            model: null,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            chatId,
          });
        } else {
          await refundCredits({
            userId: scope.userId,
            credits: charge.credits,
          });
          logger.log("Refunded a turn that produced nothing", {
            chatId,
            credits: charge.credits,
          });
        }
      }

      for (const message of newUIMessages) {
        // A stopped turn can leave an assistant message with nothing in it —
        // the user pressed stop before the first token. A partial answer is
        // worth keeping; an empty bubble is not.
        if (message.role === "assistant" && message.parts.length === 0)
          continue;

        await saveMessage({
          chatId,
          message,
          // Only the answer carries a provider; the question was not written by
          // one. Recorded per message rather than per chat because the picker
          // can change mid-conversation, and because the fallback chain can
          // change it without the user doing anything.
          provider: message.role === "assistant" ? provider : null,
        });
      }

      await reconcileRetriedAnswers(chatId, uiMessages);

      // Written unconditionally, and as its own statement. These three are what
      // a later tab reconnects with, so they must land on every turn — folding
      // them into the conditional title write below would mean a renamed chat
      // silently stopped recording where its stream had got to.
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          // Persisted together so a reconnect never has a token without the
          // cursor that tells it where to resume from.
          sessionRunId: runId,
          sessionToken: chatAccessToken,
          lastEventId,
          // And the turn is over. Written here rather than left to the browser
          // because this hook runs whether or not anyone is still watching —
          // including when the turn threw, which is the case a flag cleared on
          // the client would strand set forever.
          isStreaming: false,
        },
      });

      // The first question names the chat, and only the first. `updateMany`
      // with the default title in the filter is what makes that a single
      // statement: a chat the user has since renamed matches nothing and keeps
      // their name.
      const firstUser = newUIMessages.find(
        (message) => message.role === "user",
      );
      const title = titleFromMessage(firstUser);

      if (title) {
        await prisma.chat.updateMany({
          where: { id: chatId, title: "New chat" },
          data: { title },
        });
      }

      logger.log("Chat turn stored", {
        chatId,
        userId: scope.userId,
        messages: newUIMessages.length,
        provider,
        credits: charge?.credits ?? 0,
        stopped,
      });
    },
  });
