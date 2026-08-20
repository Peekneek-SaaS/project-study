import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The homepage's call to action.
 *
 * Not `@/components/ui/button`. That one is sized for the product — `h-7`,
 * `text-xs`, built to sit in a toolbar three to a row — and the whole job of a
 * hero button is to be the largest thing on the line. Rather than fight it
 * with overrides at every call site, the marketing size is its own component,
 * and the two are free to stay right for their own surfaces.
 *
 * Square corners and no shadow, like everything else on the page. The only
 * hover is a colour shift: at this size a transform reads as the button
 * wobbling.
 */
const TONES = {
  /** The one you are meant to press. */
  solid:
    "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]",
  /** Its neighbour — present, quieter, never competing. */
  outline:
    "border border-border bg-card text-foreground hover:bg-muted hover:border-foreground/20",
  /** On an ink band, where the solid red would be the only warm thing. */
  inkSolid:
    "bg-[oklch(0.99_0_0)] text-[oklch(0.16_0.004_106.75)] hover:bg-[oklch(0.88_0_0)]",
  inkOutline:
    "border border-[oklch(1_0_0_/_0.18)] text-[oklch(0.99_0_0)] hover:bg-[oklch(1_0_0_/_0.08)]",
} as const;

const SIZES = {
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-5 text-sm",
} as const;

export function CtaButton({
  href,
  children,
  tone = "solid",
  size = "md",
  className,
  ...props
}: {
  href: string;
  children: ReactNode;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "children" | "className">) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-none font-medium tracking-[-0.01em] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        TONES[tone],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
