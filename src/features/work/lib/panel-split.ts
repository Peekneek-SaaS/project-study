/**
 * Where the handle was left, per document.
 *
 * A cookie rather than `localStorage` because the split has to be known
 * *before* the first paint: the panels are server-rendered, and a value only
 * the browser could read would mean every work page opening at half and half
 * and jumping to the remembered size a moment later. The sidebar's own
 * `sidebar_state` cookie exists for the same reason.
 *
 * Per document, because the right split is a property of the document. A dense
 * PDF wants the room; a page of diagrams you are annotating does not. One
 * global number would have every document fighting over the same setting.
 */

export const WORK_PANEL_COOKIE = "work-panel-split";

/**
 * How many documents are remembered.
 *
 * A cookie rides on every request to this origin, so this cannot grow with the
 * drive. Each entry is an id and a short decimal — roughly 30 bytes — which
 * puts the whole thing under a kilobyte and well inside the 4KB limit. Past
 * the cap the least recently touched documents are dropped, which is the right
 * thing to lose: they are the ones whose split nobody has adjusted lately.
 */
const MAX_REMEMBERED = 24;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The document panel's share of the group, from 0 to 1, per document id. */
export type PanelSplits = Record<string, number>;

/** What a work page opens at before anyone has dragged the handle. */
export const DEFAULT_SPLIT = 0.5;

/**
 * Reads the cookie back, entry by entry.
 *
 * Every value is checked rather than the object being trusted whole. This is a
 * cookie: the user can edit it, an older version of this app may have written
 * it, and a share of `0`, `1` or `NaN` would render a panel with no width at
 * all — a work page that looks broken with nothing on screen explaining why.
 */
export function parsePanelSplits(raw: string | undefined | null): PanelSplits {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const splits: PanelSplits = {};
    for (const [documentId, value] of Object.entries(parsed)) {
      // Strictly between the two ends: a share of exactly 0 or 1 is a closed
      // panel, which is remembered separately and not by this.
      if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1) {
        splits[documentId] = value;
      }
    }
    return splits;
  } catch {
    return {};
  }
}

/**
 * The map with one document's split written to the end of it.
 *
 * Re-inserted rather than updated in place, because insertion order is what
 * makes the trim below least-recently-used: string keys keep their order in a
 * JS object, so the oldest entries are the ones at the front.
 */
export function withPanelSplit(
  splits: PanelSplits,
  documentId: string,
  share: number,
): PanelSplits {
  const { [documentId]: _previous, ...rest } = splits;
  const next: PanelSplits = { ...rest, [documentId]: share };

  const ids = Object.keys(next);
  if (ids.length <= MAX_REMEMBERED) return next;

  const trimmed: PanelSplits = {};
  for (const id of ids.slice(ids.length - MAX_REMEMBERED)) {
    trimmed[id] = next[id];
  }
  return trimmed;
}

/**
 * Turns a share into the flex-grow pair the panel group lays out from.
 *
 * Scaled to 100 rather than left as a fraction on purpose: CSS treats
 * `flex-grow` values summing to less than 1 as a request *not* to fill the
 * container, so a pair like `0.42 / 0.58` is one rounding error away from the
 * panels leaving a gap at the end of the group.
 */
export function splitToLayout(
  share: number,
  documentPanelId: string,
  sectionsPanelId: string,
) {
  return {
    [documentPanelId]: share * 100,
    [sectionsPanelId]: (1 - share) * 100,
  };
}

/** Client-side only: the current value of the cookie, if it is set. */
function readCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

/**
 * Remembers where the handle was left for one document.
 *
 * Written from the browser rather than through a server action: it is a
 * preference, it is already in the shape the server reads, and a round trip
 * per drag would be a request for something nothing on the server acts on.
 */
export function savePanelSplit(documentId: string, share: number) {
  if (!Number.isFinite(share) || share <= 0 || share >= 1) return;

  const next = withPanelSplit(
    parsePanelSplits(readCookie(WORK_PANEL_COOKIE)),
    documentId,
    // Two decimals is finer than anyone can drag and keeps the cookie small.
    Number(share.toFixed(2)),
  );

  document.cookie = [
    `${WORK_PANEL_COOKIE}=${encodeURIComponent(JSON.stringify(next))}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ].join("; ");
}
