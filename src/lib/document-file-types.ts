/**
 * The file types a document upload accepts.
 *
 * Shared by the UploadThing file route (`app/api/uploadthing/core.ts`) and the
 * upload modal so the server config, the picker's `accept` attribute, and the
 * copy shown to the user cannot drift apart.
 */

export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export const DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
] as const;

/** UploadThing's `maxFileSize` format. Keep in sync with `DOCUMENT_MAX_BYTES`. */
export const DOCUMENT_MAX_FILE_SIZE = "16MB";
export const DOCUMENT_MAX_BYTES = 16 * 1024 * 1024;

/** How many documents one upload can carry, enforced by the file route too. */
export const DOCUMENT_MAX_FILE_COUNT = 10;

/**
 * `accept` for a file input. Extensions are listed alongside the MIME types
 * because Windows reports empty or vendor-specific types for Office files.
 */
export const DOCUMENT_ACCEPT = [
  ...DOCUMENT_EXTENSIONS,
  ...Object.values(DOCUMENT_MIME_TYPES),
].join(",");

/** Human-readable version of the above, for the modal description. */
export const DOCUMENT_ACCEPT_LABEL =
  "PDF, Word (.doc, .docx) and PowerPoint (.ppt, .pptx) files, up to 16MB.";

/**
 * Matched on extension rather than `file.type`: the browser leaves `type` empty
 * for plenty of legitimate Office files, and the server re-checks anyway.
 */
export function isAcceptedDocument(file: File) {
  const name = file.name.toLowerCase();
  return DOCUMENT_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/** Only PDFs have an in-app viewer; everything else is handed to the browser. */
export function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}
