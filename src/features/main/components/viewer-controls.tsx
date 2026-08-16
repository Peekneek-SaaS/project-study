"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The bar of controls the three document viewers float over their content.
 *
 * One component rather than the same markup copied into each viewer: a PDF, a
 * .docx and a deck are read in the same frame and the controls have to behave
 * the same way in all three — the same size, the same place, the same tooltips —
 * and three copies of it had already started to drift.
 *
 * Everything here is deliberately small. The bar sits *on top of* the document
 * in a panel that can be dragged narrow or minimised into a floating window a
 * couple of hundred pixels wide, so it is sized to still be a bar at that width
 * rather than a slab across the middle of the page.
 */

/**
 * The bar itself.
 *
 * `@container`-driven, which is the whole point: the sizes below answer to the
 * viewer's own width, and a media query could not see a panel dragged narrow
 * because the window has not changed size. The viewer this is rendered in
 * carries the `@container` — see any of the three.
 *
 * `overflow-hidden` rather than a scroller. Overflowing used to mean a
 * horizontal scrollbar, which made the bar taller as well as full width, so the
 * one case it was meant to rescue — no room — was the case it looked worst in.
 * The controls are small enough to fit the narrowest frame this is used in, and
 * clipping is the quieter failure if one ever does not.
 */
export function ViewerControls({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-2">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-hidden bg-popover/95 p-0.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
        {children}
      </div>
    </div>
  );
}

/**
 * One control, with the tooltip that says what it is.
 *
 * `label` is both the tooltip and the accessible name, so the two cannot
 * disagree — every control in here is an icon, and an icon with a tooltip the
 * screen reader never sees is an unlabelled button.
 *
 * A disabled control has no tooltip: pointer events do not reach a disabled
 * button, so Radix never opens one. That is the usual trade for disabled
 * buttons, and the ones here disable only at the ends of a range they have
 * already been read as.
 */
export function ViewerControlButton({
  label,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn(
            // Square, and a size smaller again once the frame is narrow — see
            // the note on this file about the floating window.
            "rounded-none @max-xs:size-5 @max-xs:[&_svg:not([class*='size-'])]:size-2.5",
            className,
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A control that reads as text — the zoom percentage, which doubles as the
 * reset. Sized like the icons either side of it rather than like a button.
 */
export function ViewerControlValue({
  label,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <ViewerControlButton
      label={label}
      size="sm"
      className={cn(
        "px-1.5 tabular-nums @max-xs:h-5 @max-xs:px-1 @max-xs:text-[0.625rem]",
        className,
      )}
      {...props}
    >
      {children}
    </ViewerControlButton>
  );
}

/** The page or slide counter: a reading, not a control. */
export function ViewerControlReadout({ children }: { children: ReactNode }) {
  return (
    <span
      className="shrink-0 px-1 text-xs tabular-nums @max-xs:text-[0.625rem]"
      aria-live="polite"
    >
      {children}
    </span>
  );
}

/** Separates the pages from the zoom, so the bar reads as two groups. */
export function ViewerControlSeparator() {
  return (
    <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-foreground/15" />
  );
}
