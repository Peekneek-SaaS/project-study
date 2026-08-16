"use client";

import { CircleAlert, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentStatus } from "@/features/main/types";

/**
 * What fills the sections panel while there are no sections yet.
 *
 * Held to the same words as the drive's badge — queued, building, failed — so
 * a user who watched the row get here reads the same story on the page. The
 * document panel beside this is unaffected: the file is readable from the
 * moment it uploads, and only the workspace around it has to be waited for.
 */
export function WorkBuildingState({
  status,
  onRetry,
  isRetrying,
}: {
  status: DocumentStatus;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  if (status === "FAILED") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <CircleAlert className="size-8 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium">This workspace could not be built</p>
          <p className="text-sm text-muted-foreground">
            Your document is safe — only the board and notes are missing.
          </p>
        </div>
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? <Spinner /> : <RotateCw />}
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Spinner className="size-6" />
      <div className="space-y-1">
        <p className="font-medium">
          {status === "QUEUED"
            ? "Your workspace is queued"
            : "Building your workspace"}
        </p>
        <p className="text-sm text-muted-foreground">
          The board and sticky notes for this document are on their way.
        </p>
      </div>
    </div>
  );
}
