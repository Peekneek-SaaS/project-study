import { TRPCError } from "@trpc/server";
import z from "zod";

import {
  DEFAULT_NOTE_APPEARANCE,
  MAX_NOTE_FONT_SIZE,
  MIN_NOTE_FONT_SIZE,
  NOTE_COLORS,
  NOTE_TEXT_COLORS,
  randomNoteColor,
} from "@/features/sticky-notes/lib/note-appearance";
import { MODIFIED_VALUES, modifiedRange } from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** A note's body. Capped generously — it is a note, not a document. */
const MAX_CONTENT = 10_000;

/**
 * Appearance, validated against the same names the client paints with.
 *
 * Every field is optional because this is a patch: the popover changes one
 * thing at a time, and sending the other three back unchanged would let two
 * edits in flight overwrite each other.
 */
const appearanceInput = {
  color: z.enum(NOTE_COLORS).optional(),
  textColor: z.enum(NOTE_TEXT_COLORS).optional(),
  fontSize: z
    .number()
    .int()
    .min(MIN_NOTE_FONT_SIZE)
    .max(MAX_NOTE_FONT_SIZE)
    .optional(),
  showGrid: z.boolean().optional(),
};

const noteFields = {
  id: true,
  content: true,
  color: true,
  textColor: true,
  fontSize: true,
  showGrid: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Confirms a note is this user's, saying no more than "no" if it is not. */
async function assertOwned(id: string, userId: string) {
  const note = await prisma.stickyNote.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!note) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This note does not exist, or is not yours.",
    });
  }
}

/**
 * The same for the document a note is being filed under.
 *
 * Checked separately from the note itself: a `documentId` arrives from the
 * client, and without this a user could hang their notes off someone else's
 * document — the note row would still be theirs, so no later ownership check
 * would ever catch it.
 */
async function assertOwnsDocument(documentId: string, userId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  });

  if (!document) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This document does not exist, or is not yours.",
    });
  }
}

export const StickyNoteRouter = createTRPCRouter({
  /**
   * Every standalone note, newest first.
   *
   * Ordered by `createdAt` rather than `updatedAt` because the grid groups by
   * the day a note was written. Sorting on edits would move a note out from
   * under "Yesterday" the moment it was touched, which is the one thing those
   * headings promise not to do.
   *
   * `documentId: null` is the whole of "standalone", so per-document notes will
   * not appear here when they arrive — they get their own way in.
   *
   * The "modified" filter narrows on `updatedAt` while the order and the
   * grouping stay on `createdAt`. That is the point rather than an oversight:
   * asking for what you touched today should hand back the notes you touched,
   * still filed under the day each was written.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          modified: z.enum(MODIFIED_VALUES).nullable().default(null),
        })
        // Optional so the callers with nothing to filter by — the search
        // palette, a bare prefetch — can go on calling `list()`.
        .default({ modified: null }),
    )
    .query(async ({ ctx, input }) => {
      const updatedAt = modifiedRange(input.modified);

      return prisma.stickyNote.findMany({
        where: {
          userId: ctx.userId,
          documentId: null,
          ...(updatedAt && { updatedAt }),
        },
        orderBy: { createdAt: "desc" },
        select: noteFields,
      });
    }),

  /**
   * The notes taken against one document, newest first.
   *
   * The mirror of `list`: that one is everything standing on its own, this one
   * is everything belonging to a document, and no note is in both. Kept as its
   * own procedure rather than a `documentId` filter on `list` so the two have
   * separate cache keys — the notes wall and a work page are open at the same
   * time, and one invalidating the other would refetch a screen nobody changed.
   *
   * No `modified` filter: a work page shows the notes for the document in front
   * of you, and there is no toolbar there to narrow them with.
   */
  listForDocument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.stickyNote.findMany({
        where: { userId: ctx.userId, documentId: input.documentId },
        orderBy: { createdAt: "desc" },
        select: noteFields,
      });
    }),

  /**
   * Adds a note.
   *
   * The colour is random unless asked for, which is what makes a wall of them
   * look like a wall of them. Everything else starts from the shared defaults —
   * the same object the settings modal will eventually be editing.
   *
   * `documentId` is what decides where the note lands: absent, it stands on its
   * own and shows on the notes wall; present, it belongs to that document and
   * shows only on its work page.
   */
  create: protectedProcedure
    .input(
      z
        .object({
          content: z.string().max(MAX_CONTENT).optional(),
          documentId: z.string().nullish(),
          ...appearanceInput,
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      if (input?.documentId) {
        await assertOwnsDocument(input.documentId, ctx.userId);
      }

      return prisma.stickyNote.create({
        data: {
          userId: ctx.userId,
          documentId: input?.documentId ?? null,
          content: input?.content ?? "",
          color: input?.color ?? randomNoteColor(),
          textColor: input?.textColor ?? DEFAULT_NOTE_APPEARANCE.textColor,
          fontSize: input?.fontSize ?? DEFAULT_NOTE_APPEARANCE.fontSize,
          showGrid: input?.showGrid ?? DEFAULT_NOTE_APPEARANCE.showGrid,
        },
        select: noteFields,
      });
    }),

  /**
   * Changes anything about a note.
   *
   * One procedure for the text and for the appearance, because they arrive the
   * same way — a patch of whatever changed. Prisma skips `undefined` fields, so
   * an unmentioned column is left alone rather than reset.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().max(MAX_CONTENT).optional(),
        ...appearanceInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      await assertOwned(id, ctx.userId);

      return prisma.stickyNote.update({
        where: { id },
        data: patch,
        select: noteFields,
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);
      await prisma.stickyNote.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  /**
   * Deletes a whole selection at once.
   *
   * No `assertOwned` loop: `deleteMany` is scoped by `userId`, so ids that are
   * not the caller's match nothing rather than erroring the whole batch — the
   * same shape as `board.bulkRemove`, and one round trip, so a dropped request
   * partway down the list cannot leave the delete half-finished.
   */
  bulkRemove: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { count: 0 };

      const { count } = await prisma.stickyNote.deleteMany({
        where: { userId: ctx.userId, id: { in: input.ids } },
      });

      return { count };
    }),
});
