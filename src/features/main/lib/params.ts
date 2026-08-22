import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { DRIVE_TYPE_VALUES } from "@/features/main/lib/drive-filters";
import { MODIFIED_VALUES } from "@/lib/list-filters";

/**
 * The drive's filters, as URL search params.
 *
 * The URL is the single source of truth for them: the toolbar reads and writes
 * these through `useQueryStates`, `useDriveBrowser` puts the same values
 * straight into the `getContents` input, and `loadDriveFilters` parses them on
 * the server so the page can prefetch the *filtered* listing rather than an
 * unfiltered one the client would immediately have to replace.
 *
 * No defaults on purpose — an absent param parses to `null`, which is what both
 * "no filter" and "clear this filter" mean, and nuqs drops the key from the URL
 * when it is set back to `null`.
 */
export const driveFilterParsers = {
  type: parseAsStringLiteral(DRIVE_TYPE_VALUES),
  modified: parseAsStringLiteral(MODIFIED_VALUES),
};

/** Server-side reader for the above. Takes a page's `searchParams` promise. */
export const loadDriveFilters = createLoader(driveFilterParsers);

export type DriveFilters = {
  type: (typeof DRIVE_TYPE_VALUES)[number] | null;
  modified: (typeof MODIFIED_VALUES)[number] | null;
};

/**
 * Which folder the drive has open, as a URL search param.
 *
 * Kept apart from the filters above rather than added to them, for two separate
 * reasons and either one would be enough:
 *
 *   - `driveFilterParsers` is spread straight into the `getContents` input by
 *     `useDriveBrowser`. A `folder` key riding along in that object would be an
 *     input field the procedure does not declare.
 *   - The two answer different questions. The filters narrow a listing; this
 *     one *is* the listing. They travel together in the query string and are
 *     read separately at both ends.
 *
 * The param is what makes a folder survive a reload. It used to live only in a
 * zustand store, which is memory: every refresh started at the root, however
 * deep you had walked. In the URL it is restored before the first render, so
 * the server prefetches the folder you were actually in — and it can be
 * bookmarked, shared, and walked back out of with the browser's own Back.
 *
 * Absent parses to `null`, which is the root, and nuqs drops the key from the
 * URL when it is set back to `null` — so the root is a clean `/main`.
 */
export const driveFolderParsers = {
  folder: parseAsString,
};

/** Server-side reader for the above. Takes a page's `searchParams` promise. */
export const loadDriveFolder = createLoader(driveFolderParsers);
