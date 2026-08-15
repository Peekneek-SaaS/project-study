"use client";

import { Progress } from "@/components/ui/progress";

/**
 * The upload toast's contents, shaped to go *inside* a sonner toast rather than
 * to replace one.
 *
 * These are handed to `toast.loading` as its title and description, so the
 * surface, the icon, the spacing, the enter and exit animations and the
 * loading-to-success swap are all sonner's own — the same ones every other
 * toast in the app gets. The earlier version went through `toast.custom`, which
 * renders unstyled, and so had to paint a copy of that surface by hand: a
 * second definition of what a toast looks like, drifting on its own.
 */

/** One file's name, or a count once a batch is going up, with its progress. */
export function UploadToastTitle({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {/* `tabular-nums` so counting up does not shuffle the digits sideways. */}
      <span className="shrink-0 tabular-nums opacity-70">
        {Math.round(progress)}%
      </span>
    </span>
  );
}

/**
 * The bar, as the toast's description.
 *
 * Sonner's `[data-content]` is a full-width column, so this fills the toast
 * without being told how wide it is.
 */
export function UploadToastProgress({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) {
  return (
    <Progress
      value={progress}
      aria-label={`Uploading ${label}`}
      className="mt-1"
    />
  );
}
