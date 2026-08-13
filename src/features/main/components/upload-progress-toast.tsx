"use client";

import { FileText } from "lucide-react";

import { Progress } from "@/components/ui/progress";

/**
 * Body of the upload toast. Sonner's custom toasts render unstyled, so this
 * paints the popover surface itself to match the rest of the toaster.
 */
export function UploadProgressToast({
  label,
  progress,
}: {
  /** One file's name, or a count once a batch is going up. */
  label: string;
  progress: number;
}) {
  const percent = Math.round(progress);

  return (
    <div className="flex w-full flex-col gap-2 rounded-[var(--radius)] border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <Progress
        value={percent}
        aria-label={`Uploading ${label}`}
        className="bg-red-400"
      />
      <p className="text-muted-foreground">Uploading…</p>
    </div>
  );
}
