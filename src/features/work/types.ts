import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DocumentWorkspace = RouterOutputs["document"]["getWorkspace"];

/**
 * Where a document is worked on.
 *
 * A route rather than a modal, unlike the preview: a work page holds a canvas
 * and a wall of notes that are edited over a long sitting, and all of that
 * needs to survive a refresh and be linkable.
 */
export const workPath = (documentId: string) => `/work/${documentId}`;

/**
 * The sections beside the document.
 *
 * A closed union rather than free strings because the value is persisted per
 * document — see `use-work-layout` — and a key read back from storage has to be
 * checked against something before it selects a tab that no longer exists.
 */
export const WORK_TABS = ["board", "notes", "chat"] as const;

export type WorkTab = (typeof WORK_TABS)[number];

export const DEFAULT_WORK_TAB: WorkTab = "board";

export function isWorkTab(value: unknown): value is WorkTab {
  return (
    typeof value === "string" && (WORK_TABS as readonly string[]).includes(value)
  );
}

/**
 * Which corner the minimised document is parked in.
 *
 * Corners rather than free coordinates: the picture-in-picture is meant to stay
 * out of the way of whichever part of the canvas is being worked on, and four
 * places it reliably snaps to serve that better than an exact position the user
 * has to nudge back into line. It also means the position survives a resized
 * window with nothing to recompute.
 */
export const PIP_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type PipCorner = (typeof PIP_CORNERS)[number];

export const DEFAULT_PIP_CORNER: PipCorner = "bottom-right";

export function isPipCorner(value: unknown): value is PipCorner {
  return (
    typeof value === "string" &&
    (PIP_CORNERS as readonly string[]).includes(value)
  );
}
