import { keepExtension } from "@/lib/document-file-types";
import { prisma } from "@/lib/prisma";
import { deleteUploadedFiles } from "@/lib/uploadthing-server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const DocumentRouter = createTRPCRouter({
  /**
   * A single document, for its preview page.
   *
   * Note what is *not* selected: `pdfUrl` stays on the server, and the client
   * reaches the bytes through `/api/documents/[id]/file` instead.
   */
  getPreview: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, name: true, status: true },
      });

      // Missing and not-yours give the same answer on purpose: which documents
      // exist is not something a stranger gets to learn.
      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This document does not exist, or is not shared with you.",
        });
      }

      return doc;
    }),

  /**
   * Renames a document. The stored file is untouched — `name` is the drive's
   * label for it, and the bytes are addressed by id.
   *
   * The extension is the exception: it is the only record of what the file
   * actually is, so `keepExtension` puts it back rather than letting a rename
   * turn a PDF into something nothing can preview. Enforced here rather than in
   * the dialog because the name the database holds is the one everything else
   * reads.
   */
  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, name: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      // Selected rather than returned whole, as in `move`: `pdfUrl` never
      // travels to the client. The name comes back because it may not be the
      // one that was asked for.
      return prisma.document.update({
        where: { id: input.id },
        // Not clamped back to the input's 255: the column is `text`, and
        // trimming here would cut the extension straight back off again.
        data: { name: keepExtension(doc.name, input.name) },
        select: { id: true, name: true },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, pdfUrl: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      // Storage first: if it fails the row survives, so the user can retry and
      // we never leave a paid-for file with nothing pointing at it.
      await deleteUploadedFiles([doc.pdfUrl]);
      await prisma.document.delete({ where: { id: doc.id } });

      return { id: doc.id };
    }),


  // server/routers/document.ts (relevant addition)
  move: protectedProcedure
    .input(z.object({ id: z.string(), newFolderId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.newFolderId) {
        const target = await prisma.folder.findFirst({
          where: { id: input.newFolderId, userId: ctx.userId },
        });
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target folder not found",
          });
      }

      // Selected rather than returned whole: the default row carries `pdfUrl`,
      // and this response goes to the client.
      return prisma.document.update({
        where: { id: input.id },
        data: { folderId: input.newFolderId },
        select: { id: true, folderId: true },
      });
    }),
});
