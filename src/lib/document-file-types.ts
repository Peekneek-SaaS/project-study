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

/** A PDF, read in-app by `PdfViewer`. */
export function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

/** Slide decks, which get their own icon wherever a file is drawn. */
export function isSlides(fileName: string) {
  return /\.pptx?$/i.test(fileName);
}

/** Which in-app viewer reads this file, or `null` for the ones none of them do. */
export type DocumentViewerKind = "pdf" | "docx" | "pptx";

/**
 * Picks the viewer for a file, from its name.
 *
 * Each format is read as itself — a .docx is rebuilt from its OOXML, a .pptx
 * from its slides — so this is a choice between three renderers, not a route
 * into one of them via a conversion.
 *
 * `.doc` and `.ppt` return `null`, and that is the load-bearing part of this
 * function. They look like their modern namesakes in a file listing and are
 * nothing like them underneath: the pre-2007 formats are compound binary files,
 * where `.docx`/`.pptx` are zipped XML. Both viewers can only read the latter,
 * so the legacy pair keeps the download fallback rather than being handed to a
 * renderer that would fail on them.
 *
 * Extension rather than MIME type, like everything else here — a document row
 * records a name and no content type.
 */
export function documentViewerKind(fileName: string): DocumentViewerKind | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  return null;
}

/** Whether any in-app viewer can show this file at all. */
export function isViewable(fileName: string) {
  return documentViewerKind(fileName) !== null;
}

/**
 * A file's name without its extension, for the places that are labelling the
 * *subject* rather than the file — a document's board, a heading above it.
 *
 * The mirror of `keepExtension`, and it draws the line in the same place: a
 * leading dot is a hidden file rather than an extension, so it is kept.
 */
export function stripExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot <= 0 ? fileName : fileName.slice(0, dot);
}

/**
 * Puts a file's extension back on a name that dropped it.
 *
 * Nothing records a document's type but its name — `isPdf` and `isSlides` read
 * the extension, and the preview and the viewer follow them — so renaming
 * `notes.pdf` to `Notes` would quietly turn a readable PDF into a file the app
 * can only hand to the browser. A rename relabels a file; it does not convert
 * one, so the extension travels with it.
 *
 * A name that already ends in the right extension is left alone, and a file
 * that never had one has nothing to keep.
 */
export function keepExtension(previousName: string, nextName: string) {
  const dot = previousName.lastIndexOf(".");
  // `0` would be a leading dot: a hidden file, not an extension.
  if (dot <= 0) return nextName;

  const extension = previousName.slice(dot);
  return nextName.toLowerCase().endsWith(extension.toLowerCase())
    ? nextName
    : `${nextName}${extension}`;
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
