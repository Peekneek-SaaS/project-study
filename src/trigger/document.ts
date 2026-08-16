import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { EMPTY_SNAPSHOT } from "@/features/board/lib/scene";
import {
  DEFAULT_NOTE_APPEARANCE,
  randomNoteColor,
} from "@/features/sticky-notes/lib/note-appearance";
import { stripExtension } from "@/lib/document-file-types";
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
