import { Suspense } from "react";

import { DriveErrorBoundary } from "@/features/main/components/drive-error-boundary";
import { DriveTableSkeleton } from "@/features/main/components/drive-table-skeleton";
import { MainActions } from "@/features/main/components/main-actions";
import { MainContent } from "@/features/main/components/main-content";

export function MainView() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">My files</h1>
          <p className="text-sm text-muted-foreground">
            Drag documents and folders onto a folder to move them.
          </p>
        </div>
        {/* <MainActions /> */}
      </div>

      {/*
        Kept tight around the table: opening a folder changes the query key and
        re-suspends, and a boundary any higher would blank the toolbar too.
      */}
      <DriveErrorBoundary>
        <Suspense fallback={<DriveTableSkeleton />}>
          <MainContent />
        </Suspense>
      </DriveErrorBoundary>
    </div>
  );
}
