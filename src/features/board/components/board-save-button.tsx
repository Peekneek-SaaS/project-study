"use client";

import { Check, CloudAlert, Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BoardSaveState } from "@/features/board/hooks/use-board-autosave";
import { cn } from "@/lib/utils";

const COPY = {
  saved: { icon: Check, label: "Saved" },
  saving: { icon: Loader2, label: "Saving…" },
  unsaved: { icon: PencilLine, label: "Unsaved changes — click to save now" },
  error: { icon: CloudAlert, label: "Could not save — click to try again" },
} as const;

/**
 * Says whether the drawing is safe, and saves it if it is not.
 *
 * Autosave is invisible when it works, which is the problem: without this the
 * only way to know whether a board survived closing the tab is to reopen it.
 * So the state is always on screen — a tick when there is nothing outstanding,
 * a spinner while a save is in the air, a pencil while the debounce is still
 * counting down, a cloud when the last attempt failed.
 *
 * It is a button rather than a label because three of those four states are
 * ones somebody might reasonably want to *end*: the wait before an autosave,
 * and a failure that would otherwise sit there until the next stroke retries
 * it. Pressing it while there is nothing to save does nothing at all, which is
 * the right amount of nothing.
 */
export function BoardSaveButton({
  state,
  onSave,
  className,
}: {
  state: BoardSaveState;
  onSave: () => void;
  className?: string;
}) {
  const { icon: Icon, label } = COPY[state];
  const isSaving = state === "saving";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onSave}
        // Nothing to press while the request is already in the air — and a
        // second flush there would find an empty queue anyway.
        disabled={isSaving}
        aria-label={label}
        title={label}
        className={cn(
          // The canvas is behind this, and it is whatever colour the drawing
          // made it — so the surface is opaque enough to read against ink.
          "bg-card/90 shadow-sm backdrop-blur",
          state === "error" ? "text-destructive" : "text-muted-foreground",
          className,
        )}
      >
        <Icon className={cn(isSaving && "animate-spin")} />
      </Button>

      {/*
        The icon carries the state visually and the button's own label carries
        it to a pointer, but neither *announces* a change — and the failure is
        the one worth hearing about, since it is a long way from wherever the
        drawing is happening.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {label}
      </span>
    </>
  );
}
