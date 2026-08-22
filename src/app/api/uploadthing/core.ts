import { auth } from "@clerk/nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import z from "zod";

import { getEntitlements } from "@/features/billing/server/entitlements";
import { tagPlanError } from "@/features/billing/lib/plan-errors";
import {
  DOCUMENT_MAX_FILE_COUNT,
  DOCUMENT_MAX_FILE_SIZE,
  DOCUMENT_MIME_TYPES,
} from "@/lib/document-file-types";
import { queueContentProcessing } from "@/lib/content-jobs";
import { prisma } from "@/lib/prisma";
import { queueWorkspaceBuild } from "@/lib/workspace-jobs";

const f = createUploadthing();

/**
 * For full list of options and defaults, see the File Route API reference
 * @see https://docs.uploadthing.com/file-routes#route-config
 */
const documentLimits = {
  maxFileSize: DOCUMENT_MAX_FILE_SIZE,
  maxFileCount: DOCUMENT_MAX_FILE_COUNT,
} as const;

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  documentUploader: f({
    [DOCUMENT_MIME_TYPES.pdf]: documentLimits,
    [DOCUMENT_MIME_TYPES.doc]: documentLimits,
    [DOCUMENT_MIME_TYPES.docx]: documentLimits,
    [DOCUMENT_MIME_TYPES.ppt]: documentLimits,
    [DOCUMENT_MIME_TYPES.pptx]: documentLimits,
  })
    // Destination folder, chosen by whichever folder the user is browsing.
    .input(z.object({ folderId: z.string().nullable() }))
    // Set permissions and file types for this FileRoute
    .middleware(async ({ input, files }) => {
      // This code runs on your server before upload
      const { userId } = await auth();

      // If you throw, the user will not be able to upload
      if (!userId) throw new UploadThingError("Unauthorized");

      // `maxFileCount` above is counted per file type, so a mixed batch could
      // slip past it — this is the only place the whole selection is in view.
      if (files.length > DOCUMENT_MAX_FILE_COUNT) {
        throw new UploadThingError(
          `Only ${DOCUMENT_MAX_FILE_COUNT} files can go up at once.`,
        );
      }

      /*
        The plan's shelf space, checked before a byte moves.

        Here rather than in `onUploadComplete`, and that is the whole reason
        this check is worth writing: refusing after the upload means the file is
        already stored and paid for, and the user has watched a progress bar
        finish before being told no. Counting the batch in as well as what is
        already there is what stops ten files at once walking past a limit of
        three.

        Documents are counted, not pages — the page count is not known until the
        file has been read, and that check lives where it becomes knowable, in
        the processing task.
      */
      const entitlements = await getEntitlements(userId);
      const owned = await prisma.document.count({ where: { userId } });

      if (owned + files.length > entitlements.plan.documentLimit) {
        const room = Math.max(0, entitlements.plan.documentLimit - owned);
        // Tagged, so the browser can open the offer rather than only reporting
        // the refusal — see `plan-errors`. The tag is stripped before display.
        throw new UploadThingError(
          tagPlanError(
            room === 0
              ? `${entitlements.plan.name} holds ${entitlements.plan.documentLimit} documents and yours is full. Remove one, or move to a larger plan.`
              : `${entitlements.plan.name} holds ${entitlements.plan.documentLimit} documents — there is room for ${room} more.`,
            "documents",
          ),
        );
      }

      // The destination is checked here rather than in `onUploadComplete`:
      // that callback runs on a request from UploadThing, with no session to
      // authorize, so everything it needs has to be settled and passed along now.
      if (input.folderId) {
        const folder = await prisma.folder.findFirst({
          where: { id: input.folderId, userId },
          select: { id: true },
        });
        if (!folder) throw new UploadThingError("Folder not found");
      }

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId, folderId: input.folderId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      const document = await prisma.document.create({
        data: {
          userId: metadata.userId,
          folderId: metadata.folderId,
          name: file.name,
          // Named `pdfUrl` from when PDFs were the only accepted type; it holds
          // the file URL whatever the format.
          pdfUrl: file.ufsUrl,
          // The bytes have landed but the board and notes beside them have not,
          // so the document arrives queued rather than ready. `READY` is the
          // workspace job's to write — see `trigger/document.ts`.
          status: "QUEUED",
        },
      });

      // After the row exists, so neither job can start looking for a document
      // that has not been written yet.
      //
      // Two jobs rather than one, queued together and independent from here on:
      // the board and notes are ready in a second, while reading the document
      // for chat takes as long as it takes. Sequencing them would hold a
      // finished workspace behind a model call.
      await queueWorkspaceBuild(document.id);
      await queueContentProcessing(document.id);

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { documentId: document.id, name: document.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
