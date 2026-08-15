"use client";

import { MoreVertical, Palette, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NoteAppearanceControls } from "@/features/sticky-notes/components/note-appearance-controls";
import type { NoteAppearance } from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * What can be done to a note, wherever it is being looked at.
 *
 * Shared by the card and the modal — the modal is the same note at a readable
 * size, so it would be odd for it to be the one place the colours cannot be
 * changed.
 */
export function NoteToolbar({
  appearance,
  onAppearanceChange,
  onDelete,
  className,
}: {
  appearance: NoteAppearance;
  onAppearanceChange: (patch: Partial<NoteAppearance>) => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center", className)}
      // The toolbar sits on a note whose own click opens the modal; a click on
      // a button here is about the button.
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Change how this note looks"
            style={{ color: "var(--note-ink)" }}
          >
            <Palette />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          {/* The same controls the settings modal will use — this one is
              pointed at a note, that one will be pointed at the defaults. */}
          <NoteAppearanceControls
            value={appearance}
            onChange={onAppearanceChange}
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Note actions"
            style={{ color: "var(--note-ink)" }}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-36">
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
