import { TRPCError } from "@trpc/server";
import z from "zod";

import { queueContentProcessing } from "@/lib/content-jobs";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * Everything the chat reads that is not the stream itself.
 *
 * The transcript is written by the durable chat agent as it answers — see
 * `trigger/chat.ts` — and this is how it is read back afterwards: the recents
 * list, a reopened conversation, the state of a document's reading, and the
 * stream cursor a returning tab reconnects with.
 *
 * Deliberately read-only about messages. Nothing here writes a turn, because
 * the run that produced it is the only thing that knows when it is finished.
 */

/** The columns a stored message is read back through. */
const messageFields = {
  id: true,
  role: true,
  parts: true,
  provider: true,
  createdAt: true,
} as const;

/** Confirms a chat is this user's, saying no more than "no" if it is not. */
async function assertOwned(id: string, userId: string) {
  const chat = await prisma.chat.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!chat) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This chat does not exist, or is not yours.",
    });
  }

  return chat;
}

export const ChatRouter = createTRPCRouter({
  /**
   * The recents list.
   *
   * Universal chats only. A document's chat belongs to its document's page and
   * would be noise here — it is reached by opening the document, not by
   * scrolling a list of conversations.
   *
   * Empty chats are excluded rather than deleted. A row is written the moment
   * the first question is sent, so one with no messages means the request died
   * between the two; hiding it costs nothing and is kinder than a list full of
   * "New chat" entries that open on nothing.
   */
  list: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(30) })
        .default({ limit: 30 }),
    )
    .query(async ({ ctx, input }) => {
      const chats = await prisma.chat.findMany({
        where: {
          userId: ctx.userId,
          scope: "UNIVERSAL",
          messages: { some: {} },
        },
        select: {
          id: true,
          title: true,
          provider: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
        // Last spoken to, not first created — a conversation returned to after
        // a week belongs at the top.
        orderBy: { updatedAt: "desc" },
        take: input.limit,
      });

      return chats.map(({ _count, ...chat }) => ({
        ...chat,
        messageCount: _count.messages,
      }));
    }),

  /**
   * One conversation, with everything said in it.
   *
   * Returns `null` rather than throwing for a chat that is not there, because
   * "not there" is the *normal* state of the page that calls this. A new chat's
   * id is minted in the browser and the row is not written until the first
   * question reaches the streaming route, so the conversation page always loads
   * before its own row exists. A `NOT_FOUND` here would put an error boundary
   * over every new chat.
   *
   * A chat belonging to someone else returns null too, which is the same answer
   * for the same reason as everywhere else: which conversations exist is not
   * something a stranger gets to learn.
   *
   * Not paginated. A chat is read from the top and its whole history is what
   * the next question is answered against, so there is no version of this that
   * usefully returns half of one.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.chat.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: {
          id: true,
          title: true,
          scope: true,
          documentId: true,
          provider: true,
          createdAt: true,
          updatedAt: true,
          // Where the durable run had got to, so a fresh tab reattaches to a
          // turn already in flight rather than starting a second one. Only ever
          // returned to the owner — the `userId` filter above is what makes
          // handing out a session token safe.
          sessionToken: true,
          lastEventId: true,
          messages: { select: messageFields, orderBy: { createdAt: "asc" } },
        },
      });
    }),

  /**
   * A document's own conversation, and the state of the reading behind it.
   *
   * Returns a chat that may not exist yet — `messages: []` and a null id —
   * because the row is not written until the first question is asked. The panel
   * needs to render its greeting either way, and a procedure that created a
   * chat just to be looked at would fill the database with empty ones every
   * time a tab was opened.
   *
   * The content status comes back with it rather than from a second call: the
   * panel cannot decide what to draw without both, and asking separately would
   * mean rendering a composer over a document that has not been read.
   */
  forDocument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const document = await prisma.document.findFirst({
        where: { id: input.documentId, userId: ctx.userId },
        select: {
          id: true,
          name: true,
          content: {
            select: {
              status: true,
              title: true,
              subject: true,
              summary: true,
              pageCount: true,
              error: true,
            },
          },
          chat: {
            select: {
              id: true,
              title: true,
              provider: true,
              // As in `get` — the cursor a returning tab resumes from.
              sessionToken: true,
              lastEventId: true,
              messages: {
                select: messageFields,
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This document does not exist, or is not shared with you.",
        });
      }

      return {
        documentId: document.id,
        documentName: document.name,
        // Null means the reading has not been queued at all — a document that
        // predates chat. The panel offers to start it.
        content: document.content,
        chat: document.chat,
      };
    }),

  /**
   * Reads a document for chat, or reads it again.
   *
   * Three callers, one path: a document uploaded before this feature existed
   * and opened for the first time, a failed reading being retried, and a user
   * who wants a re-read after the model was having a bad day. All of them are
   * the same job with the same idempotency key, so none of them can start a
   * second run over the top of a first.
   */
  processDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        provider: z.enum(["openai", "anthropic", "google"]).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const document = await prisma.document.findFirst({
        where: { id: input.documentId, userId: ctx.userId },
        select: { id: true },
      });
      if (!document) throw new TRPCError({ code: "NOT_FOUND" });

      // Marked before the job is queued, not after: the client refetches the
      // moment this returns, and a row still saying `FAILED` would show the
      // error again over a read that is already under way.
      await prisma.documentContent.upsert({
        where: { documentId: document.id },
        create: {
          documentId: document.id,
          userId: ctx.userId,
          status: "PENDING",
        },
        update: { status: "PENDING", error: null },
      });

      await queueContentProcessing(document.id, input.provider);

      return { documentId: document.id };
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      return prisma.chat.update({
        where: { id: input.id },
        data: { title: input.title.trim() },
        select: { id: true, title: true },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      // The messages go with it — `onDelete: Cascade` on the relation, so this
      // is one statement rather than two that could half-succeed.
      await prisma.chat.delete({ where: { id: input.id } });

      return { id: input.id };
    }),

  /**
   * Deletes everything ticked in the recents list.
   *
   * Ownership is a `where` clause rather than a check per id: `deleteMany`
   * filters and deletes in one statement, so a list containing someone else's
   * chat quietly deletes only the caller's rather than failing the whole batch
   * — and never reveals which of the ids was not theirs.
   *
   * Returns the count actually removed, which is what the toast reports. It can
   * be lower than the number asked for, and that is the honest answer.
   */
  bulkRemove: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await prisma.chat.deleteMany({
        where: { id: { in: input.ids }, userId: ctx.userId },
      });

      return { count };
    }),
});
