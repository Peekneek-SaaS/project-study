"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSceneVersion, serializeAsJSON } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";

/** Long enough to cover a stroke and the pause after it, short enough to trust. */
const SAVE_DEBOUNCE_MS = 1500;

export type BoardSaveState = "saved" | "saving" | "unsaved" | "error";

/**
 * Keeps a board's scene in the database while it is being drawn on.
 *
 * Excalidraw reports a change on every pointer move, so this leans on two
 * things rather than the callback itself. `getSceneVersion` is a cheap hash of
 * the elements, and it is what separates a real edit from a pan, a zoom, or a
 * selection — none of which are worth a round trip. What survives that is then
 * debounced, so a stroke costs one save rather than fifty.
 *
 * The version is seeded from the scene as loaded, so opening a board and
 * touching nothing writes nothing.
 */
export function useBoardAutosave(boardId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const save = useMutation(trpc.board.save.mutationOptions());

  const [state, setState] = useState<BoardSaveState>("saved");

  const timer = useRef<number | null>(null);
  /** The scene as last written — or as loaded, before anything is written. */
  const savedVersion = useRef<number | null>(null);
  /** The latest scene, waiting for the debounce to run out. */
  const pending = useRef<{ snapshot: string; version: number } | null>(null);

  // `mutateAsync` off a ref so the flush below is not rebuilt — and so the
  // unmount flush is not cancelled and re-registered on every render, which
  // would mean a save on every render. Written in an effect rather than during
  // the render that reads it: a render can be thrown away, and this one is
  // about what to do after the last one.
  const saveRef = useRef(save.mutateAsync);
  useEffect(() => {
    saveRef.current = save.mutateAsync;
  });

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const next = pending.current;
    if (!next) return;
    pending.current = null;

    setState("saving");
    try {
      await saveRef.current({
        id: boardId,
        snapshot: JSON.parse(next.snapshot),
      });
      savedVersion.current = next.version;
      setState("saved");
      // The table sorts on `updatedAt`, so it is stale the moment this lands.
      // Not awaited: nothing on this page is waiting to render it.
      void queryClient.invalidateQueries(trpc.board.list.queryFilter());
    } catch (error) {
      // Put the work back, so the next edit's debounce retries this scene
      // rather than leaving it stranded. Only if nothing newer arrived while
      // the request was in the air — that one is already more current.
      pending.current ??= next;
      setState("error");
      toast.error(
        error instanceof Error ? error.message : "Could not save the board",
      );
    }
  }, [boardId, queryClient, trpc]);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const version = getSceneVersion(elements);

      // First report after mount: the scene as loaded, which is already what
      // the database holds.
      if (savedVersion.current === null) {
        savedVersion.current = version;
        return;
      }

      // Panning, zooming, selecting — the scene itself did not move.
      if (version === savedVersion.current) return;

      pending.current = {
        // `serializeAsJSON` strips the parts of `appState` that describe this
        // session rather than the drawing — cursors, collaborators, what is
        // selected — so reopening the board does not restore someone's
        // half-finished interaction.
        snapshot: serializeAsJSON(elements, appState, files, "local"),
        version,
      };
      setState("unsaved");

      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // Leaving the page mid-debounce would otherwise drop the last edit.
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  return { handleChange, state };
}
