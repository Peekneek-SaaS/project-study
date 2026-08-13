"use client";

import { TableCell } from "@/components/ui/table";
import { DriveActionsShield } from "@/features/main/components/drive-actions-shield";
import { cn } from "@/lib/utils";

/** Action cell for a drive row. The opting-out lives in `DriveActionsShield`. */
export function DriveRowActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableCell className={cn("text-right", className)}>
      <DriveActionsShield className="justify-end gap-1">
        {children}
      </DriveActionsShield>
    </TableCell>
  );
}
