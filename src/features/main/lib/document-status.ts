import type {
  ContentStatus,
  DocumentStatus,
} from "@/generated/prisma/enums";

/**
 * The status types come from Prisma's generated enums rather than from
 * `main/types`, which infers them back out of the tRPC router.
 *
 * That is not a style preference. `folder.ts` imports this file, `main/types`
 * infers its types *from* `folder.ts`'s router, and a lib in the middle
 * importing from `main/types` closes the loop — at which point TypeScript gives
 * up on inferring `AppRouter` at all and every procedure on it collapses to
 * `any`, taking every `trpc.*` call in the app with it. The generated enums are
 * the same union with no path back to the router.
 */

/**
 * Whether a document is still on its way somewhere.
 *
 * The single definition of "not settled yet", because two places poll on it and
 * they have to agree: the drive listing re-asks while any row is transient, and
 * so does a work page about its own document. A disagreement would show as one
 * of them never noticing a build had finished.
 *
 * `FAILED` is settled. It changes only when someone retries, and a retry
 * refetches on its own — polling a failure would be asking the same question
 * forever.
 */
export function isTransientStatus(status: DocumentStatus) {
  return status === "UPLOADING" || status === "QUEUED" || status === "BUILDING";
}

/**
 * How far along a document is *overall* — its board, its notes, and the reading
 * that chat answers from.
 *
 * Two jobs build a document and each owns its own column: `Document.status` is
 * the workspace build, `DocumentContent.status` is the chat reading. They stay
 * separate on purpose — they fail differently and are retried differently, and
 * one column written by two tasks is a race waiting to happen.
 *
 * But the drive shows one badge, and a user does not care which of two
 * background jobs is still going: "Complete" has to mean the whole document is
 * done. So the two are combined at the point of *reading* rather than of
 * writing, which keeps the tasks independent and still tells the truth.
 *
 * Deliberately not used to gate opening a document. The workspace is usually
 * ready minutes before a long book has been read, and there is no reason to
 * withhold the board and the notes in the meantime — see `Document.status`,
 * which the row still uses for that.
 */
export function deriveDocumentStatus(
  workspace: DocumentStatus,
  /** Null for a document uploaded before chat existed — nothing to wait for. */
  content: ContentStatus | null,
): DocumentStatus {
  // The workspace speaks first while it is still working, because its states
  // are the more specific ones — "Uploading" and "Queued" say more than a flat
  // "Building" would.
  if (workspace !== "READY") return workspace;

  switch (content) {
    // A document from before chat, or one whose reading was never queued.
    // There is no third job to wait for, so the workspace's answer stands.
    case null:
      return "READY";
    case "PENDING":
    case "PROCESSING":
      return "BUILDING";
    // The board and notes are fine and the document opens and reads perfectly
    // — only chat cannot search it. Reported as failed anyway, because the
    // alternative is calling a document "Complete" when a third of what was
    // promised is missing. The chat tab explains which part, and offers to run
    // it again.
    case "FAILED":
      return "FAILED";
    case "READY":
      return "READY";
  }
}
