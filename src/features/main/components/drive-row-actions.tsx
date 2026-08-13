"use client";

import { TableCell } from "@/components/ui/table";
import { NO_DRAG_ATTRIBUTE } from "@/features/main/lib/drive-sensors";
import { cn } from "@/lib/utils";

/**
 * Action cell for a drive row.
 *
 * The row is the drag element, so the cell has to opt out twice: the marker
 * attribute keeps dnd-kit's pointer sensor from starting a drag (it binds
 * natively, below React), and stopping the click keeps the row's own handler
 * from firing on top of the button's.
 */
export function DriveRowActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableCell
      {...{ [NO_DRAG_ATTRIBUTE]: "" }}
      onClick={(event) => event.stopPropagation()}
      className={cn("text-right", className)}
    >
      <div className="flex items-center justify-end gap-1">{children}</div>
    </TableCell>
  );
}
