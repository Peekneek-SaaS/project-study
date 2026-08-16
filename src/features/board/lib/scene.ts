/**
 * A stored Excalidraw scene, as far as this app's types are concerned.
 *
 * Deliberately shallow. Prisma types a `Json` column as a recursive union, and
 * asking TypeScript to carry that through tRPC's output inference and then
 * compare it against Excalidraw's element union makes it give up outright
 * ("type instantiation is excessively deep"). Nothing here reads into a scene,
 * so three optional fields is the whole of what needs to be true — the canvas
 * casts them back at the one point it hands them to Excalidraw.
 */
export interface StoredScene {
  elements?: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

/**
 * What a board starts as, so `snapshot` is never null and always restorable.
 *
 * Lives here rather than in the board router because it is no longer the
 * router's alone: the workspace job writes the boards that belong to documents,
 * and a board built by the job has to open exactly like one made by hand.
 */
export const EMPTY_SNAPSHOT = {
  elements: [],
  appState: {},
  files: {},
} as const satisfies StoredScene;
