import type { DocumentStatus } from "@/features/main/types";

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
