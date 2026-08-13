"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  type DriveViewType,
  useDriveView,
} from "@/lib/stores/drive-view-store";

/**
 * The loading state for whichever view is on.
 *
 * A client component so it can read the view: opening a folder re-suspends, and
 * a table skeleton flashing over a grid of cards reads as the layout breaking.
 */
export function DriveTableSkeleton({
  serverView,
  rows = 5,
}: {
  serverView: DriveViewType;
  rows?: number;
}) {
  const view = useDriveView(serverView);

  if (view === "grid") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="rounded-xl bg-muted/60 p-2">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="h-44 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableBody>
        {Array.from({ length: rows }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-48" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-8" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
