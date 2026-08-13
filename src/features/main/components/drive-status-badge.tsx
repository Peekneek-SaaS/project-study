import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/features/main/types";

const STATUS_BADGES: Record<
  DocumentStatus,
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  UPLOADING: { label: "Uploading", variant: "secondary" },
  PROCESSING: { label: "Processing", variant: "outline" },
  READY: { label: "Ready", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
};

// Tone is kept off the variant map so the palette stays theme-aware.
const STATUS_TONES: Record<DocumentStatus, string> = {
  UPLOADING: "",
  PROCESSING:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  READY:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED: "",
};

export function DriveStatusBadge({ status }: { status: DocumentStatus }) {
  const badge = STATUS_BADGES[status];
  if (!badge) return null;

  return (
    <Badge variant={badge.variant} className={STATUS_TONES[status]}>
      {badge.label}
    </Badge>
  );
}
