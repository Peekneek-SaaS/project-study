import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The frame every mock screenshot on this page sits in.
 *
 * These are not images. Every "screenshot" below is the real markup at a
 * smaller type scale, which is worth the effort three times over: it stays
 * sharp on any display, it follows the theme into dark mode instead of going
 * grey in the middle of a black page, and it cannot go stale the way a PNG
 * exported from a build six months ago does.
 *
 * The trade is that all of it has to be *small* — 10 and 11px type, 1px rules
 * — and that only reads as a screenshot if the chrome around it is honest. So:
 * a window bar with real controls, and the same square corners as the app.
 */
export function MockupWindow({
  children,
  className,
  title,
  toolbar,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-none border border-border bg-card shadow-lg",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-none bg-foreground/15" />
          <span className="size-2 rounded-none bg-foreground/15" />
          <span className="size-2 rounded-none bg-foreground/15" />
        </div>
        {title ? (
          <div className="min-w-0 flex-1 truncate text-center text-[10.5px] font-medium text-foreground/50">
            {title}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {toolbar ? (
          <div className="flex shrink-0 items-center gap-1.5">{toolbar}</div>
        ) : (
          <div className="w-[38px]" />
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** A labelled control in a mock toolbar — square, quiet, non-interactive. */
export function MockPill({
  children,
  className,
  active,
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-none border px-1.5 py-0.5 text-[10px] leading-none font-medium",
        active
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border bg-background text-foreground/55",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Stand-in body copy.
 *
 * Grey bars rather than lorem ipsum: at 10px, fake Latin is legible enough to
 * be read *at*, and a visitor squinting to work out whether the demo document
 * says anything is a visitor not looking at the product. Bars say "text here"
 * and nothing else.
 */
export function TextLines({
  count = 4,
  className,
  widths,
  tone = "light",
}: {
  count?: number;
  className?: string;
  widths?: number[];
  tone?: "light" | "ink";
}) {
  const fallback = [100, 96, 99, 88, 94, 97, 72, 92];
  return (
    <div className={cn("space-y-[5px]", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-[3px] rounded-none",
            tone === "light" ? "bg-foreground/10" : "bg-[oklch(1_0_0_/_0.12)]",
          )}
          style={{ width: `${(widths ?? fallback)[index % (widths ?? fallback).length]}%` }}
        />
      ))}
    </div>
  );
}
