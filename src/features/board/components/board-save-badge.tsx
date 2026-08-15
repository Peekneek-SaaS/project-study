"use client";

import { Check, CloudAlert, Loader2, PencilLine } from "lucide-react";

import type { BoardSaveState } from "@/features/board/hooks/use-board-autosave";
import { cn } from "@/lib/utils";

const COPY = {
  saved: { icon: Check, label: "Saved" },
  saving: { icon: Loader2, label: "Saving…" },
  unsaved: { icon: PencilLine, label: "Unsaved changes" },
  error: { icon: CloudAlert, label: "Could not save" },
} as const;

/**
 * Says whether the drawing is safe.
 *
 * Autosave is invisible when it works, which is the problem: without this the
 * only way to know whether a board survived closing the tab is to reopen it.
 */
export function BoardSaveBadge({ state }: { state: BoardSaveState }) {
  const { icon: Icon, label } = COPY[state];

  return (
    <div
      // Announced rather than just shown: the failure is the one that matters,
      // and it is a long way from wherever the pointer is.
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 rounded-md bg-card/90 px-2 py-1 text-xs shadow-sm ring-1 ring-border backdrop-blur",
        state === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} />
      {label}
    </div>
  );
}
