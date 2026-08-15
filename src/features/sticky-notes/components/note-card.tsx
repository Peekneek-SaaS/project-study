"use client";

import { useState } from "react";
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
import { useNoteMutations } from "@/features/sticky-notes/hooks/use-note-mutations";
import {
  noteAppearanceStyle,
  toNoteAppearance,
} from "@/features/sticky-notes/lib/note-appearance";
import type { StickyNote } from "@/features/sticky-notes/types";
import { cn } from "@/lib/utils";

/**
 * One sticky note.
 *
 * The size is fixed and stays fixed — that is the point of a wall of them, and
 * it is why the body scrolls rather than the card growing. Text is held in
 * local state rather than driven by the row: the note keeps typing responsive
 * while the save is still on its debounce, and a refetch of the list (someone
 * added a note elsewhere on the page) cannot reach in and replace a sentence
 * half-written.
 */
export function NoteCard({ note }: { note: StickyNote }) {
  const { saveContent, patchAppearance, removeNote, isRemoving } =
    useNoteMutations(note.id);

  // Seeded once. The row's `content` is not read again for the life of this
  // card, deliberately — see above.
  const [content, setContent] = useState(note.content);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const appearance = toNoteAppearance(note);

  const handleChange = (value: string) => {
    setContent(value);
    saveContent(value);
  };

  return (
    <article
      // Every per-note value arrives as a custom property, so the stylesheet
      // below stays free of anything specific to this note.
      style={{
        ...noteAppearanceStyle(appearance),
        borderColor: "var(--note-edge)",
      }}
      className={cn(
        "flex h-56 flex-col overflow-hidden rounded-lg border shadow-sm transition-opacity",
        isRemoving && "pointer-events-none opacity-50",
      )}
    >
      <div
        className="flex items-center justify-between gap-1 px-1.5 py-1"
        style={{ background: "var(--note-bg)" }}
      >
        <span className="sr-only">Note</span>
        <div className="ml-auto flex items-center">
          <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
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
                onChange={(patch) => void patchAppearance(patch)}
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
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void removeNote()}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Write something…"
        aria-label="Note text"
        spellCheck={false}
        style={{
          background: "var(--note-bg)",
          color: "var(--note-ink)",
          fontSize: "var(--note-font-size)",
          lineHeight: "var(--note-line-height)",
        }}
        className={cn(
          // `flex-1` with `min-h-0` is what keeps the card one height: the
          // textarea takes what is left and scrolls the rest, instead of the
          // content deciding how tall the note is.
          "min-h-0 flex-1 resize-none px-3 pb-3 outline-none",
          "placeholder:opacity-50",
          appearance.showGrid && "note-ruled",
        )}
      />
    </article>
  );
}
