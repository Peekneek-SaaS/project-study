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
