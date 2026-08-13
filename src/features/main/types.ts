import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DriveContents = RouterOutputs["folder"]["getContents"];
export type DriveFolder = DriveContents["folders"][number];
export type DriveDocument = DriveContents["documents"][number];
export type DocumentStatus = DriveDocument["status"];

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
