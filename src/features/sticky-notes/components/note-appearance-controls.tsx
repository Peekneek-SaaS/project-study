"use client";

import { Grid2X2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  MAX_NOTE_FONT_SIZE,
  MIN_NOTE_FONT_SIZE,
  NOTE_COLOR_LABELS,
  NOTE_COLORS,
  NOTE_TEXT_COLOR_LABELS,
  NOTE_TEXT_COLORS,
  type NoteAppearance,
  stepFontSize,
} from "@/features/sticky-notes/lib/note-appearance";
import { cn } from "@/lib/utils";

/**
 * The controls for everything a note looks like.
 *
 * Presentational and note-agnostic on purpose: it takes a value and reports
 * changes, and has no idea whether that value is one note's row or the account
 * default. The settings modal will mount this exact component against the
 * defaults — which is why it takes a whole `NoteAppearance` rather than a note,
 * and why it emits a patch rather than saving anything itself.
 */
export function NoteAppearanceControls({
  value,
  onChange,
  className,
}: {
  value: NoteAppearance;
  /** A patch of what changed, never the whole object — see the router's `update`. */
  onChange: (patch: Partial<NoteAppearance>) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Note colour</Label>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ color })}
              aria-label={NOTE_COLOR_LABELS[color]}
              aria-pressed={value.color === color}
              // The swatch is the colour, so it is drawn with the same tokens
              // the note is — no second definition to drift.
              style={{
                background: `var(--note-${color})`,
                borderColor: `var(--note-${color}-edge)`,
              }}
              className={cn(
                "size-6 rounded-md border transition-transform",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                value.color === color &&
                  "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Text colour</Label>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_TEXT_COLORS.map((textColor) => (
            <button
              key={textColor}
              type="button"
              onClick={() => onChange({ textColor })}
              aria-label={NOTE_TEXT_COLOR_LABELS[textColor]}
              aria-pressed={value.textColor === textColor}
              className={cn(
                "flex size-6 items-center justify-center rounded-md border text-xs font-semibold",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                value.textColor === textColor &&
                  "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
              style={{ color: `var(--note-ink-${textColor})` }}
            >
              A
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Text size</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Smaller text"
            disabled={value.fontSize <= MIN_NOTE_FONT_SIZE}
            onClick={() =>
              onChange({ fontSize: stepFontSize(value.fontSize, -1) })
            }
          >
            <Minus />
          </Button>
          {/* Tabular, so stepping through sizes does not shuffle the buttons. */}
          <span className="w-8 text-center text-xs tabular-nums">
            {value.fontSize}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Larger text"
            disabled={value.fontSize >= MAX_NOTE_FONT_SIZE}
            onClick={() =>
              onChange({ fontSize: stepFontSize(value.fontSize, 1) })
            }
          >
            <Plus />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor="note-grid-lines"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Grid2X2 className="size-3.5" />
          Grid lines
        </Label>
        <Switch
          id="note-grid-lines"
          checked={value.showGrid}
          onCheckedChange={(showGrid) => onChange({ showGrid })}
        />
      </div>
    </div>
  );
}
