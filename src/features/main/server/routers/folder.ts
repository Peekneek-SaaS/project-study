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

  getContents: protectedProcedure
    .input(z.object({ folderId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const [folders, documents] = await Promise.all([
        prisma.folder.findMany({
          where: { userId: ctx.userId, parentId: input.folderId },
          orderBy: { name: "asc" },
        }),
        prisma.document.findMany({
          where: { userId: ctx.userId, folderId: input.folderId },
          orderBy: { name: "asc" },
        }),
      ]);
      return { folders, documents };
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

  // For the "Move to..." folder picker — full tree, lightweight fields only
  getTree: protectedProcedure.query(async ({ ctx }) => {
    const all = await prisma.folder.findMany({
      where: { userId: ctx.userId },
      select: { id: true, name: true, parentId: true },
    });
    return all;
  }),
});
