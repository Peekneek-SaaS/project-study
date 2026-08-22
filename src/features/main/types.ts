import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DriveContents = RouterOutputs["folder"]["getContents"];
export type DriveFolder = DriveContents["folders"][number];
export type DriveDocument = DriveContents["documents"][number];
export type DocumentStatus = DriveDocument["status"];

/**
 * Where the drive is drawn.
 *
 * A folder *does* have a URL: it is this path with `?folder=<id>` on it, which
 * is what lets a reload, a bookmark and the Back button all land in the folder
 * you were in. Opening one from elsewhere is therefore a single navigation
 * rather than the two-step it used to be — `useDriveNavigation` owns both
 * halves, and nothing else should be building this path by hand.
 */
export const DRIVE_PATH = "/main";

/** dnd-kit `type`/`accept` categories. */
export const DRAG_TYPE = {
  folder: "folder",
  document: "document",
} as const;

export const DROPPABLE_ACCEPTS = [DRAG_TYPE.folder, DRAG_TYPE.document];

/**
 * Payloads attached to dnd-kit draggables/droppables. Reading the target out of
 * `data` keeps us from parsing element ids back into folder ids, and lets a
 * droppable point at the root (`folderId: null`), which has no id to encode.
 */
export type DriveDragData =
  | { kind: "folder"; id: string }
  | { kind: "document"; id: string };

export interface DriveDropData {
  folderId: string | null;
}

/** Draggables and droppables are separate registries, but distinct ids read clearer. */
export const dragId = (data: DriveDragData) => `drag:${data.kind}:${data.id}`;
export const dropId = (folderId: string | null) => `drop:${folderId ?? "root"}`;
