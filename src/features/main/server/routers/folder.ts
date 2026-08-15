import {
  DRIVE_TYPE_VALUES,
  typeExtensions,
} from "@/features/main/lib/drive-filters";
import { MODIFIED_VALUES, modifiedRange } from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";
import { deleteUploadedFiles } from "@/lib/uploadthing-server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import z from "zod";

/** A folder and every folder beneath it, walked a level at a time. */
async function collectFolderIds(
  db: typeof prisma,
  userId: string,
  rootId: string,
): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const children = await db.folder.findMany({
      where: { userId, parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((child) => child.id);
    ids.push(...frontier);
  }

  return ids;
}

async function isDescendant(
  db: typeof prisma,
  folderId: string,
  potentialAncestorId: string,
): Promise<boolean> {
  // Walk up from potentialAncestorId's parent chain — if we hit folderId, it's a cycle
  let current = await db.folder.findUnique({
    where: { id: potentialAncestorId },
  });
  while (current?.parentId) {
    if (current.parentId === folderId) return true;
    current = await db.folder.findUnique({ where: { id: current.parentId } });
  }
  return false;
}

export const FolderRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        parentId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.parentId) {
        const parent = await prisma.folder.findFirst({
          where: { id: input.parentId, userId: ctx.userId },
        });
        if (!parent)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent folder not found",
          });
      }
      return prisma.folder.create({
        data: {
          name: input.name,
          parentId: input.parentId,
          userId: ctx.userId,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
      return prisma.folder.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });

      // Subfolders cascade, but `Document.folderId` is `onDelete: SetNull` —
      // left to the schema the documents inside would survive as loose files at
      // the root, so gather the whole subtree and take them out deliberately.
      const folderIds = await collectFolderIds(prisma, ctx.userId, folder.id);
      const documents = await prisma.document.findMany({
        where: { userId: ctx.userId, folderId: { in: folderIds } },
        select: { pdfUrl: true },
      });

      // Storage first, for the same reason as `document.remove`.
      await deleteUploadedFiles(documents.map((doc) => doc.pdfUrl));

      await prisma.$transaction([
        prisma.document.deleteMany({
          where: { userId: ctx.userId, folderId: { in: folderIds } },
        }),
        prisma.folder.delete({ where: { id: folder.id } }),
      ]);

      return { id: folder.id };
    }),

  /**
   * Deletes a whole selection at once.
   *
   * The same rules as the single deletes, applied together: a folder takes its
   * subtree with it, and storage is emptied before the rows are, so a failure
   * leaves rows pointing at files rather than files nobody points at. One round
   * trip, so a half-finished bulk delete cannot be caused by a dropped request
   * partway down the list.
   */
  bulkRemove: protectedProcedure
    .input(
      z.object({
        folderIds: z.array(z.string()),
        documentIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Ownership is settled here, once: everything below works from ids that
      // came back from a `userId`-scoped read, and ids that are not the
      // caller's simply fall out rather than erroring the whole batch.
      const owned = await prisma.folder.findMany({
        where: { id: { in: input.folderIds }, userId: ctx.userId },
        select: { id: true },
      });

      const subtrees = await Promise.all(
        owned.map((folder) => collectFolderIds(prisma, ctx.userId, folder.id)),
      );
      // Selecting a folder and something inside it is one delete, not two.
      const folderIds = [...new Set(subtrees.flat())];

      // Documents picked directly, plus everything living under a folder on the
      // way out. An empty `in` matches nothing, so either half can be absent.
      const documents = await prisma.document.findMany({
        where: {
          userId: ctx.userId,
          OR: [
            { id: { in: input.documentIds } },
            { folderId: { in: folderIds } },
          ],
        },
        select: { id: true, pdfUrl: true },
      });

      if (folderIds.length === 0 && documents.length === 0) {
        return { folders: 0, documents: 0 };
      }

      await deleteUploadedFiles(documents.map((doc) => doc.pdfUrl));

      await prisma.$transaction([
        prisma.document.deleteMany({
          where: {
            userId: ctx.userId,
            id: { in: documents.map((doc) => doc.id) },
          },
        }),
        prisma.folder.deleteMany({
          where: { userId: ctx.userId, id: { in: folderIds } },
        }),
      ]);

      return { folders: folderIds.length, documents: documents.length };
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), newParentId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.newParentId === input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot move a folder into itself",
        });
      }

      if (input.newParentId) {
        const newParent = await prisma.folder.findFirst({
          where: { id: input.newParentId, userId: ctx.userId },
        });
        if (!newParent)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target folder not found",
          });

        const wouldCycle = await isDescendant(
          prisma,
          input.id,
          input.newParentId,
        );
        if (wouldCycle) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot move a folder into its own subfolder",
          });
        }
      }
      return prisma.folder.update({
        where: { id: input.id },
        data: { parentId: input.newParentId },
      });
    }),

  /**
   * Moves a whole selection into one folder.
   *
   * A folder that cannot legally land in the target — it *is* the target, or the
   * target sits inside it — is skipped rather than failing the batch: the rest
   * of a selection is still a perfectly good move, and the count comes back so
   * the caller can say what was left behind.
   */
  bulkMove: protectedProcedure
    .input(
      z.object({
        folderIds: z.array(z.string()),
        documentIds: z.array(z.string()),
        targetFolderId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.targetFolderId) {
        const target = await prisma.folder.findFirst({
          where: { id: input.targetFolderId, userId: ctx.userId },
          select: { id: true },
        });
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target folder not found",
          });
      }

      const owned = await prisma.folder.findMany({
        where: { id: { in: input.folderIds }, userId: ctx.userId },
        select: { id: true },
      });

      const movable: string[] = [];
      for (const folder of owned) {
        if (folder.id === input.targetFolderId) continue;
        if (
          input.targetFolderId &&
          (await isDescendant(prisma, folder.id, input.targetFolderId))
        ) {
          continue;
        }
        movable.push(folder.id);
      }

      // `updateMany` is scoped by `userId`, so ids that are not the caller's
      // match nothing instead of erroring — same shape as `bulkRemove`.
      const [folders, documents] = await prisma.$transaction([
        prisma.folder.updateMany({
          where: { userId: ctx.userId, id: { in: movable } },
          data: { parentId: input.targetFolderId },
        }),
        prisma.document.updateMany({
          where: { userId: ctx.userId, id: { in: input.documentIds } },
          data: { folderId: input.targetFolderId },
        }),
      ]);

      return {
        folders: folders.count,
        documents: documents.count,
        skipped: owned.length - movable.length,
      };
    }),

  /**
   * One folder's contents, narrowed by the toolbar's filters.
   *
   * The filters are applied here rather than over the returned rows because a
   * listing is only small until it isn't: filtering in the database keeps the
   * response proportional to what is actually shown, and both clauses ride the
   * `[userId, parentId]` / `[userId, folderId]` indexes that already scope the
   * listing to this folder.
   */
  getContents: protectedProcedure
    .input(
      z.object({
        folderId: z.string().nullable(),
        type: z.enum(DRIVE_TYPE_VALUES).nullable().default(null),
        modified: z.enum(MODIFIED_VALUES).nullable().default(null),
      }),
    )
    .query(async ({ ctx, input }) => {
      const updatedAt = modifiedRange(input.modified);
      const extensions = input.type ? typeExtensions(input.type) : null;

      const documentsQuery = prisma.document.findMany({
        where: {
          userId: ctx.userId,
          folderId: input.folderId,
          ...(updatedAt && { updatedAt }),
          // `endsWith` per extension rather than one regex, so Prisma keeps it
          // a plain `LIKE` — and case-insensitive because nothing normalises a
          // name on the way in, so `.PDF` is as likely as `.pdf`.
          ...(extensions && {
            OR: extensions.map((extension) => ({
              name: { endsWith: extension, mode: "insensitive" as const },
            })),
          }),
        },
        orderBy: { name: "asc" },
        // `pdfUrl` is deliberately absent: it is a public UploadThing URL,
        // and it never leaves the server. The client addresses a document
        // through our own routes instead — see `lib/document-links.ts`.
        select: {
          id: true,
          name: true,
          status: true,
          folderId: true,
          isLocked: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Filtering by type asks a question folders have no answer to, so they
      // leave the listing rather than sitting there unfiltered above the files.
      // Not queried at all in that case — the empty listing is known here.
      const folders = extensions
        ? []
        : await prisma.folder.findMany({
            where: {
              userId: ctx.userId,
              parentId: input.folderId,
              ...(updatedAt && { updatedAt }),
            },
            orderBy: { name: "asc" },
          });

      return { folders, documents: await documentsQuery };
    }),

  getBreadcrumb: protectedProcedure
    .input(z.object({ folderId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const trail: { id: string; name: string }[] = [];
      let currentId = input.folderId;
      while (currentId) {
        const folder = await prisma.folder.findFirst({
          where: { id: currentId, userId: ctx.userId },
        });
        if (!folder) break;
        trail.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
      }
      return trail;
    }),

  /**
   * Everything the account owns, flat, for the search palette.
   *
   * Takes no query on purpose: one drive's worth of names is small enough to
   * hand over once and filter in the browser, which keeps the palette instant
   * and saves a round trip per keystroke. `pdfUrl` stays behind, as in
   * `getContents` — the documents come back shaped like the ones the table
   * renders, so the palette can hand them straight to `useOpenDocument`.
   */
  getAllItems: protectedProcedure.query(async ({ ctx }) => {
    const [folders, documents] = await Promise.all([
      prisma.folder.findMany({
        where: { userId: ctx.userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, parentId: true },
      }),
      prisma.document.findMany({
        where: { userId: ctx.userId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          folderId: true,
          isLocked: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return { folders, documents };
  }),

  // For the "Move to..." folder picker — full tree, lightweight fields only
  getTree: protectedProcedure.query(async ({ ctx }) => {
    const all = await prisma.folder.findMany({
      where: { userId: ctx.userId },
      select: { id: true, name: true, parentId: true },
    });
    return all;
  }),
});
