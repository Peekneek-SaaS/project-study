import { TRPCError } from "@trpc/server";
import z from "zod";

import type { StoredScene } from "@/features/board/lib/scene";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * A scene, as far as this router is concerned.
 *
 * Loose on purpose: the shape belongs to Excalidraw, and pinning it down here
 * would mean a schema change every time they add an `appState` key. `elements`
 * is checked because it is the one thing the canvas cannot open without.
 */
const snapshotSchema = z
  .object({
    elements: z.array(z.json()),
    appState: z.record(z.string(), z.json()).optional(),
    files: z.record(z.string(), z.json()).optional(),
  })
  // `z.json()` rather than `unknown` for the keys nobody named: it is the same
  // "anything" as far as validation goes, but it types as something a JSON
  // column will accept, which `unknown` does not.
  .catchall(z.json());

/** What a board starts as, so `snapshot` is never null and always restorable. */
const EMPTY_SNAPSHOT = { elements: [], appState: {}, files: {} };

/** Columns the list needs. `snapshot` is deliberately absent — see `list`. */
const listFields = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Confirms a board is this user's, and says nothing more than "no" if it is
 * not. Missing and not-yours give the same answer for the same reason as in
 * `document.getPreview`: which boards exist is not a stranger's to learn.
 */
async function assertOwned(id: string, userId: string) {
  const board = await prisma.board.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!board) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This board does not exist, or is not yours.",
    });
  }

  return board;
}

export const BoardRouter = createTRPCRouter({
  /**
   * Every standalone board, newest edit first.
   *
   * `documentId: null` is the whole of "standalone". Boards belonging to a
   * document are already excluded here, so when per-document boards arrive they
   * will not turn up in this table by surprise — they get their own way in.
   *
   * Snapshots are not selected: a scene is unbounded, and a table that only
   * shows names would otherwise carry every drawing in the account.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.board.findMany({
      where: { userId: ctx.userId, documentId: null },
      orderBy: { updatedAt: "desc" },
      select: listFields,
    });
  }),

  /** One board, with its scene, for the canvas. */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { ...listFields, snapshot: true },
      });

      if (!board) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This board does not exist, or is not yours.",
        });
      }

      // Narrowed on the way out — see `StoredScene` for why the column's own
      // type cannot travel.
      return { ...board, snapshot: board.snapshot as unknown as StoredScene };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.board.create({
        // No `documentId`: everything this router creates stands on its own.
        // The per-document case will pass one, and the unique constraint is
        // what will keep it to a single board.
        data: {
          userId: ctx.userId,
          name: input.name,
          snapshot: EMPTY_SNAPSHOT,
        },
        select: listFields,
      });
    }),

  /**
   * Writes the scene back.
   *
   * Called on a debounce while drawing, so it does the least it can: ownership,
   * then one update. The whole scene goes every time rather than a diff —
   * Excalidraw has no patch format, and a scene is small next to the round trip
   * that carries it.
   */
  save: protectedProcedure
    .input(z.object({ id: z.string(), snapshot: snapshotSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      const board = await prisma.board.update({
        where: { id: input.id },
        data: { snapshot: input.snapshot },
        select: { id: true, updatedAt: true },
      });

      return board;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      return prisma.board.update({
        where: { id: input.id },
        data: { name: input.name },
        select: listFields,
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      // Nothing in storage to clean up first, unlike `document.remove`: a board
      // is entirely its own row.
      await prisma.board.delete({ where: { id: input.id } });

      return { id: input.id };
    }),
});
