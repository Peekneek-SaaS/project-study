import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { MAX_SCANNED_PAGES, processDocument } from "@/lib/ai/document-processing";
import { UnsupportedDocumentError } from "@/lib/ai/extraction";
import { EMPTY_SNAPSHOT } from "@/features/board/lib/scene";
import {
  DEFAULT_NOTE_APPEARANCE,
  randomNoteColor,
} from "@/features/sticky-notes/lib/note-appearance";
import { stripExtension } from "@/lib/document-file-types";
import { cleanPlanError } from "@/features/billing/lib/plan-errors";
import {
  documentCredits,
  getEntitlements,
  InsufficientCreditsError,
  ocrCredits,
  PlanLimitError,
  recordUsage,
  refundCredits,
  spendCredits,
} from "@/features/billing/server/entitlements";
import { prisma } from "@/lib/prisma";

/**
 * Everything that happens to a document in the background.
 *
 * One file per subject rather than one per task: a document's jobs share the
 * same rows, the same status column and the same idea of what "done" means, and
 * splitting them across files is how two of them end up disagreeing about it.
 */

/**
 * What the first note on a new document says.
 *
 * Not empty. An empty wall gives no clue that notes are a thing this page does,
 * and the note is editable the moment it is opened — so the worst case is a
 * user deleting one note, against a best case of them discovering the feature.
 */
const STARTER_NOTE = "Notes for this document.";

/**
 * Builds the workspace that sits beside a document: its board and its notes.
 *
 * Triggered once when the upload finishes, and again on demand for documents
 * that predate workspaces — see `document.buildWorkspace`. Both paths land
 * here, so there is one definition of what a workspace is.
 *
 * Written to be safe to run twice. Every step asks what already exists before
 * it writes, because a retry after a half-finished attempt is the ordinary
 * case, not the exceptional one: the board is an upsert on the unique
 * `documentId`, and the starter note is skipped if the document has any notes
 * at all. A user who deletes the starter note and retries the job does not get
 * it back.
 */
export const buildDocumentWorkspace = schemaTask({
  id: "build-document-workspace",
  schema: z.object({ documentId: z.string() }),
  // Generous next to the work, which is three queries. It is a ceiling for a
  // wedged run rather than an estimate.
  maxDuration: 120,
  run: async ({ documentId }) => {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        name: true,
        board: { select: { id: true } },
        _count: { select: { stickyNotes: true } },
      },
    });

    // Deleted between the upload finishing and the job starting. Nothing to
    // build and nothing a retry would fix, so the run stops rather than
    // burning its three attempts on a row that is not coming back.
    if (!document) {
      throw new AbortTaskRunError(
        `Document ${documentId} no longer exists; nothing to build.`,
      );
    }

    logger.log("Building workspace", { documentId, name: document.name });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "BUILDING" },
    });

    // `upsert` on the unique `documentId` rather than a create: it is what
    // makes a second run reuse the first run's board instead of failing on the
    // constraint. `update: {}` because an existing board is already right —
    // the user may have drawn on it since, and a retry must not wipe that.
    const board = await prisma.board.upsert({
      where: { documentId },
      create: {
        userId: document.userId,
        documentId,
        // The document's name without its extension: the board is *about* the
        // document, and "lecture-03.pdf" reads oddly as the title of a canvas.
        name: stripExtension(document.name),
        snapshot: EMPTY_SNAPSHOT,
      },
      update: {},
      select: { id: true },
    });

    if (document._count.stickyNotes === 0) {
      await prisma.stickyNote.create({
        data: {
          userId: document.userId,
          documentId,
          content: STARTER_NOTE,
          color: randomNoteColor(),
          textColor: DEFAULT_NOTE_APPEARANCE.textColor,
          fontSize: DEFAULT_NOTE_APPEARANCE.fontSize,
          showGrid: DEFAULT_NOTE_APPEARANCE.showGrid,
        },
      });
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });

    return { documentId, boardId: board.id };
  },

  /**
   * Runs once the last attempt has failed, so the drive stops saying "Building"
   * about something nothing is building any more.
   *
   * Not in a `catch` inside `run`: that would fire on the first attempt and
   * mark a document failed while two retries were still to come.
   */
  onFailure: async ({ payload, error }) => {
    logger.error("Workspace build failed", { ...payload, error });

    // Scoped to the states this job owns. A document that was deleted, or that
    // some other path has already carried to `READY`, is left as it is.
    await prisma.document.updateMany({
      where: {
        id: payload.documentId,
        status: { in: ["QUEUED", "BUILDING"] },
      },
      data: { status: "FAILED" },
    });
  },
});

/**
 * How many chunks go into one `createMany`.
 *
 * A textbook can produce hundreds, and a single statement carrying all of them
 * builds a query long enough to upset the pooler. Batched, each insert is
 * ordinary-sized and the whole thing still runs inside one transaction.
 */
const CHUNK_INSERT_BATCH = 200;

/**
 * Reads a document so the chat can answer from it.
 *
 * Separate from `buildDocumentWorkspace` — separate task, separate status
 * column, separate failure — because they are separate promises to the user.
 * The workspace is a board and some notes, built in three queries and done in a
 * second; this fetches a file, parses it, and talks to a model, and may take
 * minutes on a long book. Folding them together would mean a slow read holding
 * up a canvas that was ready immediately, and a model outage marking a document
 * `FAILED` when its workspace built perfectly well.
 *
 * Safe to run twice, like its sibling. The content row is an upsert on the
 * unique `documentId`, and the chunks are deleted and rewritten inside the same
 * transaction as the row that owns them — so a retry replaces a half-written
 * reading rather than adding a second one beside it, and a search never sees
 * the document in two states at once.
 */
export const processDocumentContent = schemaTask({
  id: "process-document-content",
  schema: z.object({
    documentId: z.string(),
    /**
     * Which provider to start the chain at, when the run was asked for by
     * someone who had picked one. Absent for the automatic run after upload,
     * which takes the default order.
     */
    provider: z.enum(["openai", "anthropic", "google"]).nullish(),
  }),
  /**
   * Fifteen minutes. Generous against the work — a long PDF, one structure
   * call — but this is the task that talks to three providers in sequence when
   * the first two are timing out, and the ceiling has to sit above that.
   */
  maxDuration: 900,
  // Parsing a 16MB PDF holds the whole document and its page text in memory at
  // once, which is more than the smallest machine has to spare.
  machine: "small-2x",
  run: async ({ documentId, provider }) => {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, userId: true, name: true, pdfUrl: true },
    });

    // Deleted between the upload finishing and the job starting. Nothing to
    // read and nothing a retry would fix.
    if (!document) {
      throw new AbortTaskRunError(
        `Document ${documentId} no longer exists; nothing to read.`,
      );
    }

    logger.log("Reading document", { documentId, name: document.name });

    // Written before the work rather than after it, so the document's chat tab
    // can say "reading this document" for the minutes it takes rather than
    // showing an empty state that looks like nothing is happening.
    const content = await prisma.documentContent.upsert({
      where: { documentId },
      create: {
        documentId,
        userId: document.userId,
        status: "PROCESSING",
      },
      update: { status: "PROCESSING", error: null },
      select: { id: true },
    });

    /*
      What this document has been charged, so the catch below can give it back.

      Declared outside the `try` because that is the only scope both halves can
      see. It stays at zero until the debit has actually succeeded, so a refund
      on a path that failed earlier is a no-op rather than free credits.
    */
    let charged = 0;

    /*
      The OCR half of that charge, kept separately so it can be given back on
      its own.

      A transcription that was allowed, paid for and then came back empty — a
      model that refused, a PDF it could not open — leaves the document readable
      from whatever the extractor found and the user out of pocket for a pass
      that produced nothing. Only this part is refunded; the reading itself did
      happen.
    */
    let ocrCharge = 0;

    try {
      const response = await fetch(document.pdfUrl);
      if (!response.ok) {
        throw new Error(
          `Could not fetch the uploaded file (${response.status}).`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());

      /*
        What this document costs, decided the moment its size is known.

        Charged before the model is called and refunded if the run then fails —
        the alternative, billing on success, means a document that fails on its
        third retry has had three digest calls paid for by nobody. The page
        count comes from local extraction, so a refusal here has cost a fetch
        and some CPU rather than a provider call.
      */
      const processed = await processDocument({
        bytes,
        fileName: document.name,
        preferredProvider: provider ?? null,
        onExtracted: async ({ pageCount, looksScanned }) => {
          const entitlements = await getEntitlements(document.userId);
          const { plan } = entitlements;

          if (pageCount > plan.pageLimit) {
            throw new PlanLimitError(
              "pages",
              `This document is ${pageCount} pages and ${plan.name} reads up ` +
                `to ${plan.pageLimit.toLocaleString()}. A larger plan will ` +
                `read it in full.`,
            );
          }

          /*
            OCR is the most expensive thing here, so it is plan-gated and priced
            on top rather than folded into the page rate.

            The page ceiling is part of the *price*, not just the transcriber's
            own limit: `transcribeScanned` refuses anything over
            `MAX_SCANNED_PAGES` and returns null, so charging for a 200-page
            scan would be charging for work that was never going to happen. The
            document still gets read — whatever text the extractor found is kept
            — it simply is not transcribed, and is not billed as if it were.
          */
          const allowOcr =
            looksScanned && plan.ocr && pageCount <= MAX_SCANNED_PAGES;

          ocrCharge = allowOcr ? ocrCredits(pageCount) : 0;
          const cost = documentCredits(pageCount) + ocrCharge;

          await spendCredits({ userId: document.userId, credits: cost });
          charged = cost;

          logger.log("Charged for reading a document", {
            documentId,
            pageCount,
            credits: cost,
            ocr: allowOcr,
          });

          return { allowOcr };
        },
      });

      logger.log("Read document", {
        documentId,
        pages: processed.pageCount,
        chunks: processed.chunks.length,
        provider: processed.provider,
      });

      await prisma.$transaction(async (tx) => {
        // The old reading goes before the new one lands, in the same
        // transaction: a search running concurrently sees either the previous
        // reading or this one, never both stitched together.
        await tx.documentChunk.deleteMany({ where: { documentId } });

        await tx.documentContent.update({
          where: { id: content.id },
          data: {
            status: "READY",
            title: processed.title,
            subject: processed.subject,
            summary: processed.summary,
            // Cast because Prisma types a Json column as an object or a
            // primitive, and this is an array of them — which is valid JSON and
            // valid for the column, just not expressible in that union.
            outline: processed.outline as unknown as Prisma.InputJsonValue,
            topics: processed.topics,
            pageCount: processed.pageCount,
            provider: processed.provider,
            model: processed.model,
            error: null,
            processedAt: new Date(),
          },
        });

        for (let at = 0; at < processed.chunks.length; at += CHUNK_INSERT_BATCH) {
          await tx.documentChunk.createMany({
            data: processed.chunks
              .slice(at, at + CHUNK_INSERT_BATCH)
              .map((chunk) => ({
                documentId,
                contentId: content.id,
                userId: document.userId,
                index: chunk.index,
                pageStart: chunk.pageStart,
                pageEnd: chunk.pageEnd,
                section: chunk.section,
                text: chunk.text,
              })),
          });
        }
      });

      // Paid for a transcription that did not happen — see `ocrCharge`.
      if (ocrCharge > 0 && !processed.transcribed) {
        await refundCredits({ userId: document.userId, credits: ocrCharge });
        charged -= ocrCharge;
        logger.log("Refunded an OCR pass that produced nothing", {
          documentId,
          credits: ocrCharge,
        });
      }

      await recordUsage({
        userId: document.userId,
        kind: processed.transcribed ? "OCR" : "DOCUMENT",
        credits: charged,
        provider: processed.provider,
        model: processed.model,
        documentId,
      });

      return {
        documentId,
        pageCount: processed.pageCount,
        chunkCount: processed.chunks.length,
        credits: charged,
      };
    } catch (error) {
      /*
        Whatever went wrong, the user does not pay for it.

        First thing in the handler, before any branch decides what kind of
        failure this was, because every one of them ends with the work not
        having been done. `charged` is zero until the moment the debit
        succeeded, so this is safe on the paths that failed before it.
      */
      if (charged > 0) {
        await refundCredits({ userId: document.userId, credits: charged });
        logger.log("Refunded credits for a failed reading", {
          documentId,
          credits: charged,
        });
        charged = 0;
      }

      /*
        Out of credits, or past a plan's limits.

        Both are finished answers rather than failures to retry — a 400-page
        document will still be 400 pages on the third attempt, and an empty
        balance will still be empty a second later. The message is written to
        be read by the person who uploaded the file, and it is what the drive
        shows against the document.
      */
      if (
        error instanceof InsufficientCreditsError ||
        error instanceof PlanLimitError
      ) {
        await prisma.documentContent.update({
          where: { id: content.id },
          // Cleaned, not raw. This message is *stored* and then shown against
          // the document in the drive, and a machine tag has no business in the
          // database or on that row — the tag exists for errors that are
          // thrown at a browser, which this one is not.
          data: { status: "FAILED", error: cleanPlanError(error.message) },
        });

        logger.warn("Document refused by plan limits", {
          documentId,
          userId: document.userId,
          reason: error.name,
        });

        return { documentId, pageCount: 0, chunkCount: 0, credits: 0 };
      }

      // A format nothing here can read is a finished answer, not a failure to
      // retry: a .doc will still be a .doc on the third attempt. The row is
      // marked with something the user can act on and the run ends cleanly.
      if (error instanceof UnsupportedDocumentError) {
        await prisma.documentContent.update({
          where: { id: content.id },
          data: { status: "FAILED", error: error.message },
        });

        logger.warn("Document format cannot be read", {
          documentId,
          name: document.name,
        });

        return { documentId, pageCount: 0, chunkCount: 0, credits: 0 };
      }

      throw error;
    }
  },

  /**
   * Runs once the last attempt has failed, so the document stops claiming to be
   * mid-read forever.
   *
   * Not a `catch` inside `run` — that would mark it failed while two retries
   * were still to come, and a provider that was briefly down is the ordinary
   * reason to be here.
   */
  onFailure: async ({ payload, error }) => {
    logger.error("Document read failed", { ...payload, error });

    await prisma.documentContent.updateMany({
      where: { documentId: payload.documentId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        // The user sees this, so it says what to do rather than what broke.
        error:
          "This document could not be read for chat. You can try again from " +
          "its chat tab.",
      },
    });
  },
});
