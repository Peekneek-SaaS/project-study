import "server-only";

import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

// Type-only, deliberately. Importing the task *instance* would pull the whole
// `/trigger` module — and Prisma, and the SDK's run machinery — into the Next
// bundle that triggers it. The id below is the contract instead; it has to
// match `buildDocumentWorkspace`'s, and the generic is what makes TypeScript
// check the payload against it.
import type { buildDocumentWorkspace } from "@/trigger/document";

import { prisma } from "@/lib/prisma";

const BUILD_WORKSPACE_TASK = "build-document-workspace";

/**
 * Hands a document's workspace build to Trigger.dev.
 *
 * Shared by the upload route and `document.buildWorkspace` so both queue the
 * same task with the same key, and a document uploaded and immediately opened
 * cannot end up with two runs racing to build one board.
 *
 * The caller is expected to have already moved the document to `QUEUED` — that
 * is what the drive reads, and doing it here would mean every caller's status
 * write depended on this one succeeding.
 */
export async function queueWorkspaceBuild(documentId: string) {
  // Global scope, not the default `run`: there is no run here to scope to, and
  // "once per document" is the property worth having. The TTL is what keeps it
  // from being once *ever* — a build that failed an hour ago must be retryable,
  // while two calls seconds apart collapse into one run.
  const idempotencyKey = await idempotencyKeys.create(
    `build-workspace-${documentId}`,
    { scope: "global" },
  );

  try {
    await tasks.trigger<typeof buildDocumentWorkspace>(
      BUILD_WORKSPACE_TASK,
      { documentId },
      { idempotencyKey, idempotencyKeyTTL: "10m" },
    );
  } catch (error) {
    // Reaching Trigger.dev is the one part of this that depends on something
    // outside the database — a missing `TRIGGER_SECRET_KEY`, an outage. The
    // upload itself succeeded and the file is safe, so the document is marked
    // failed rather than the whole request being torn down: the drive shows it
    // as such, and the work page offers to try again.
    console.error("[workspace] could not queue build", { documentId, error });

    await prisma.document.updateMany({
      where: { id: documentId, status: { in: ["QUEUED", "BUILDING"] } },
      data: { status: "FAILED" },
    });
  }
}
