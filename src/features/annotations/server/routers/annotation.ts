import { TRPCError } from "@trpc/server";
import z from "zod";

import { MAX_QUOTE_LENGTH } from "@/features/annotations/lib/anchor";
import {
  MAX_NOTE_CONTENT,
  MAX_NOTE_FONT_SIZE,
  MIN_NOTE_FONT_SIZE,
  NOTE_COLORS,
  NOTE_FONT_FAMILIES,
  NOTE_TEXT_COLORS,
  randomNoteColor,
} from "@/features/sticky-notes/lib/note-appearance";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * Notes written onto a page of a document.
 *
 * Shaped after `StickyNoteRouter` — the same appearance patch, the same
 * ownership checks, the same field list — because they are the same kind of
 * object with an anchor bolted on, and two routers that behave differently for
 * no reason are two routers to keep in your head.
 */

/**
 * Appearance, validated against the same names the client paints with.
 *
 * Every field optional because this is a patch: the popover changes one thing
 * at a time, and sending the other three back unchanged would let two edits in
 * flight overwrite each other.
 */
const appearanceInput = {
  color: z.enum(NOTE_COLORS).optional(),
  textColor: z.enum(NOTE_TEXT_COLORS).optional(),
  fontFamily: z.enum(NOTE_FONT_FAMILIES).optional(),
  fontSize: z
    .number()
    .int()
    .min(MIN_NOTE_FONT_SIZE)
    .max(MAX_NOTE_FONT_SIZE)
    .optional(),
  showGrid: z.boolean().optional(),
};

/**
 * The anchor, as fractions.
 *
 * Bounded at both ends rather than merely typed as numbers: these go straight
 * into a `left: %` on a positioned element, and a value outside 0–1 puts a dot
 * somewhere no scrollbar can reach. The client already clamps — see
 * `rectToAnchor` — and this is the half of that which cannot be skipped by
 * calling the endpoint directly.
 */
const fraction = z.number().min(0).max(1);

const anchorInput = {
  pageNumber: z.number().int().min(1),
  x: fraction,
  y: fraction,
  width: fraction,
  height: fraction,
  /**
   * The lines the selection covers, bounded like the box around them.
   *
   * Capped at a sensible number rather than left open: these go straight into
   * a Json column and are all rendered, and a range covering a whole chapter
   * would be hundreds of rectangles nobody asked to paint.
   */
  rects: z
    .array(
      z.object({ x: fraction, y: fraction, width: fraction, height: fraction }),
    )
    .max(200)
    .default([]),
};

const annotationFields = {
  id: true,
  documentId: true,
  pageNumber: true,
  x: true,
  y: true,
  width: true,
  height: true,
  rects: true,
  quote: true,
  content: true,
  color: true,
  textColor: true,
  fontFamily: true,
  fontSize: true,
  showGrid: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Confirms an annotation is this user's, saying no more than "no" if it is not. */
async function assertOwned(id: string, userId: string) {
  const row = await prisma.documentAnnotation.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This note does not exist, or is not yours.",
    });
  }
}

/**
 * The same for the document an annotation is being written onto.
 *
 * Checked separately from the annotation itself, and for the reason the notes
 * router spells out: a `documentId` arrives from the client, and without this a
 * user could hang their annotations off someone else's document — the row would
 * still be theirs, so no later ownership check would ever catch it.
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

export const AnnotationRouter = createTRPCRouter({
  /**
   * Every annotation on one document.
   *
   * The whole document rather than a page at a time, deliberately. The viewer
   * mounts and unmounts pages as you scroll — see `RENDER_WINDOW` — so a
   * per-page query would fire on every page turn and re-fetch the same rows
   * repeatedly. Annotations are small and there are tens of them, not
   * thousands, so one query at open is cheaper than the request-per-page it
   * would replace, and it means a page scrolling into view already has its dots
   * rather than growing them a moment later.
   *
   * Newest first. A note just written is the one being thought about, so it
   * belongs at the top of every list that shows these — and where several sit
   * on one sentence, the most recent is the one whose card should read first.
   *
   * `createdAt` and not `updatedAt`, so editing an old note does not haul it
   * back to the top of a list the reader was working down.
   */
  listForDocument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.documentAnnotation.findMany({
        where: { userId: ctx.userId, documentId: input.documentId },
        orderBy: { createdAt: "desc" },
        select: annotationFields,
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        quote: z.string().max(MAX_QUOTE_LENGTH).default(""),
        content: z.string().max(MAX_NOTE_CONTENT).default(""),
        ...anchorInput,
        ...appearanceInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsDocument(input.documentId, ctx.userId);

      return prisma.documentAnnotation.create({
        data: {
          ...input,
          userId: ctx.userId,
          // The client normally sends this — it has to, because the composer
          // paints itself the paper the note is about to be. The fallback is
          // for a caller that did not, and it draws from the same palette so a
          // note created without one is still one of the six rather than a
          // seventh, odder colour that only appears on that path.
          color: input.color ?? randomNoteColor(),
        },
        select: annotationFields,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().max(MAX_NOTE_CONTENT).optional(),
        ...appearanceInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      await assertOwned(id, ctx.userId);

      return prisma.documentAnnotation.update({
        where: { id },
        data: patch,
        select: annotationFields,
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);
      await prisma.documentAnnotation.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
