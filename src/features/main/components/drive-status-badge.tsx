import { Check, CircleAlert, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/features/main/types";
import { cn } from "@/lib/utils";

/**
 * How far along a document's workspace is, as one badge.
 *
 * Each state gets its own mark rather than colour alone: a dot that has not
 * started, a spinner that is turning, a tick that is done. Colour carries the
 * same meaning underneath, but it is the second signal — the shapes are what
 * the badge still says to someone who cannot tell amber from emerald.
 */
const STATUS_BADGES: Record<
  DocumentStatus,
  {
    label: string;
    icon: "dot" | "spinner" | "tick" | "alert";
    className: string;
  }
> = {
  UPLOADING: {
    label: "Uploading",
    icon: "spinner",
    className: "border-border text-muted-foreground",
  },
  QUEUED: {
    label: "Queued",
    icon: "dot",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  },
  BUILDING: {
    label: "Building",
    icon: "spinner",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  READY: {
    label: "Complete",
    icon: "tick",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  FAILED: {
    label: "Failed",
    icon: "alert",
    className:
      "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
};

function StatusIcon({ icon }: { icon: (typeof STATUS_BADGES)[DocumentStatus]["icon"] }) {
  switch (icon) {
    case "dot":
      // A plain filled circle rather than an icon glyph: it is the one state
      // that is not doing anything, and a shape with no detail reads that way.
      return (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-orange-500 dark:bg-orange-400"
        />
      );
    case "spinner":
      return <Loader2 aria-hidden className="size-3 shrink-0 animate-spin" />;
    case "tick":
      return <Check aria-hidden className="size-3 shrink-0" />;
    case "alert":
      return <CircleAlert aria-hidden className="size-3 shrink-0" />;
  }
}

export function DriveStatusBadge({ status }: { status: DocumentStatus }) {
  const badge = STATUS_BADGES[status];
  if (!badge) return null;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", badge.className)}
      // The row's status changes underneath the user while a build runs, so the
      // badge announces itself rather than changing silently.
      aria-live={status === "QUEUED" || status === "BUILDING" ? "polite" : undefined}
    >
      <StatusIcon icon={badge.icon} />
      {badge.label}
    </Badge>
  );
}
