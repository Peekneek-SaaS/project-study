import { createLoader, parseAsStringLiteral } from "nuqs/server";

import {
  DRIVE_MODIFIED_VALUES,
  DRIVE_TYPE_VALUES,
} from "@/features/main/lib/drive-filters";

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
  modified: parseAsStringLiteral(DRIVE_MODIFIED_VALUES),
};

/** Server-side reader for the above. Takes a page's `searchParams` promise. */
export const loadDriveFilters = createLoader(driveFilterParsers);

export type DriveFilters = {
  type: (typeof DRIVE_TYPE_VALUES)[number] | null;
  modified: (typeof DRIVE_MODIFIED_VALUES)[number] | null;
};
