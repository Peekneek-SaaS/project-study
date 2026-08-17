import "server-only";

import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

// Type-only, for the same reason `workspace-jobs.ts` does it: importing the
// task instance would pull `/trigger` — and Prisma, and the SDK's run machinery,
// and now a PDF parser — into whichever Next bundle triggers it. The id below is
// the contract, and the generic is what makes TypeScript check the payload
// against the real task.
import type { processDocumentContent } from "@/trigger/document";

import type { AiProvider } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

const PROCESS_CONTENT_TASK = "process-document-content";

/**
 * Hands a document's reading to Trigger.dev.
 *
 * Called from three places — the upload route, a retry from the document's chat
 * tab, and the first time an older document's chat is opened — so all three
 * queue the same task under the same key and a document opened the moment it
 * finishes uploading cannot end up with two runs indexing it at once.
 *
 * The TTL is what keeps "once per document" from meaning "once ever": a read
 * that failed an hour ago has to be retryable, while two calls seconds apart
 * collapse into one run. Longer than the workspace build's ten minutes because
 * the work itself is longer — a retry offered while the first attempt is still
 * parsing a book should join it rather than start a second one.
 */
export async function queueContentProcessing(
  documentId: string,
  provider?: AiProvider | null,
) {
  /**
   * The row exists before the job does.
   *
   * Written here rather than left to the task, so the drive can say "Building"
   * from the moment of upload. Created by the task instead, there is a window —
   * short for a small file, long when the queue is busy — where the workspace
   * has finished and the reading has not started, and the document has no
   * content row at all. The badge would call that "Complete" and then walk it
   * back to "Building" a moment later, which reads as the app changing its mind.
   */
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { userId: true },
  });

  // Deleted between the upload finishing and this running. Nothing to read, and
  // nothing to attribute a row to.
  if (!document) return;

  await prisma.documentContent.upsert({
    where: { documentId },
    create: { documentId, userId: document.userId, status: "PENDING" },
    // An existing row is a re-run — a retry, or a document being read again.
    // Clearing the error is what stops the last failure showing over a job that
    // has only just been queued.
    update: { status: "PENDING", error: null },
  });

  const idempotencyKey = await idempotencyKeys.create(
    `process-content-${documentId}`,
    { scope: "global" },
  );

  try {
    await tasks.trigger<typeof processDocumentContent>(
      PROCESS_CONTENT_TASK,
      { documentId, provider: provider ?? null },
      { idempotencyKey, idempotencyKeyTTL: "20m" },
    );
  } catch (error) {
    // Reaching Trigger.dev is the one part of this that depends on something
    // outside the database. The upload itself succeeded and the file is safe,
    // so the content row is marked failed rather than the request being torn
    // down: the document's chat tab shows it, and offers to try again.
    console.error("[content] could not queue processing", { documentId, error });

    // The row is already there — it was written above, before the trigger was
    // attempted — so this only has to change what it says.
    await prisma.documentContent.updateMany({
      where: { documentId },
      data: {
        status: "FAILED",
        error: "This document could not be queued for reading. Try again.",
      },
    });
  }
}
