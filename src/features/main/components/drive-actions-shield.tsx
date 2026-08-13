"use client";

import { NO_DRAG_ATTRIBUTE } from "@/features/main/lib/drive-sensors";
import { cn } from "@/lib/utils";

/**
 * Wraps the controls sitting inside a row or a card.
 *
 * Whatever is in here has to opt out of its container twice: the marker
 * attribute keeps dnd-kit's pointer sensor (which binds natively, below React)
 * from reading a button press as the start of a drag, and stopping the clicks
 * keeps the row or card from selecting or opening underneath it.
 */
export function DriveActionsShield({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      {...{ [NO_DRAG_ATTRIBUTE]: "" }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn("flex items-center", className)}
    >
      {children}
    </div>
  );
}
