import "server-only";

import { UTApi } from "uploadthing/server";

/** Reads `UPLOADTHING_TOKEN` from the environment. */
export const utapi = new UTApi();

/**
 * File key out of an UploadThing URL.
 *
 * A document only records where its file lives (`Document.pdfUrl`), and the
 * delete API takes keys — but every UploadThing URL is `<host>/f/<key>`, so the
 * key is the last segment. Returns `null` for anything that is not one of ours.
 */
export function fileKeyFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const key = pathname.split("/f/")[1];
    return key ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}

/**
 * Removes the stored files behind a set of document URLs.
 *
 * Deleting unknown keys is not an error on UploadThing's side, so this is safe
 * to call for documents whose file is already gone.
 */
export async function deleteUploadedFiles(urls: string[]) {
  const keys = urls
    .map(fileKeyFromUrl)
    .filter((key): key is string => key !== null);

  if (keys.length === 0) return;
  await utapi.deleteFiles(keys);
}
