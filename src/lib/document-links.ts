/**
 * Where a document lives *as far as the browser is concerned*.
 *
 * `Document.pdfUrl` holds a public UploadThing URL — anyone holding it can read
 * the file, forever, with no session involved. So it stays server-side, and
 * everything the client touches goes through one of these two routes, each of
 * which checks who is asking before it answers.
 */

/** The shareable page for a document. Owner-only for now. */
export const documentPreviewPath = (documentId: string) =>
  `/preview/${documentId}`;

/** The bytes themselves, proxied so the storage URL is never handed out. */
export const documentFilePath = (documentId: string) =>
  `/api/documents/${documentId}/file`;
