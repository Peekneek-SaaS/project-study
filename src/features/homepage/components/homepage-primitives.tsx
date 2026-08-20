"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { REVEAL_VIEWPORT } from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT, fadeUp, listContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Anything that should arrive as it is scrolled to.
 *
 * `whileInView` rather than the app's usual `animate`, because a marketing page
 * is read top to bottom over several seconds — playing every entrance at mount
 * would mean the whole page had already finished moving before the reader got
 * to the third section.
 *
 * The variants are the app's own (`fadeUp`), not a set invented here. The page
 * is louder than the product but it should not move differently from it.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  viewport = REVEAL_VIEWPORT,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  viewport?: { once: boolean; amount: number };
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      transition={{ duration: DURATION.base, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A group whose children deal themselves in one after another.
 *
 * Pairs with `RevealItem`. Split from `Reveal` because the stagger has to be
 * declared on the parent and the children must carry no timing of their own —
 * a child with its own `transition` fights the container's `staggerChildren`
 * and the grain disappears.
 */
export function RevealGroup({
  children,
  className,
  viewport = REVEAL_VIEWPORT,
}: {
  children: ReactNode;
  className?: string;
  viewport?: { once: boolean; amount: number };
}) {
  return (
    <motion.div
      className={className}
      variants={listContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/**
 * The small tag that names a section before its headline does.
 *
 * Square, like everything else here — the app runs at `--radius: 0rem` and the
 * homepage is not the place to make an exception. The tint is the product's
 * red rather than the reference's blue, at the low opacity that keeps it a
 * label rather than a button.
 */
export function Eyebrow({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "ink";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-none px-2 py-1 font-mono text-[11px] leading-none font-medium tracking-[0.12em] uppercase",
        tone === "light"
          ? "bg-primary/10 text-primary"
          : "bg-[oklch(1_0_0_/_0.08)] text-[oklch(0.83_0.13_31)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The page's signature headline: a statement, then its explanation, set as one
 * paragraph in two tones.
 *
 * The whole thing is a single block of text rather than a heading with a
 * subtitle under it, which is the detail that makes the reference's sections
 * read the way they do — the eye takes the dark half as the claim and the grey
 * half as the caveat without a line break having to say so.
 */
export function SectionHeading({
  lead,
  rest,
  className,
  tone = "light",
  as: Tag = "h2",
}: {
  lead: ReactNode;
  rest?: ReactNode;
  className?: string;
  tone?: "light" | "ink";
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={cn(
        "max-w-4xl text-[clamp(1.75rem,4vw,3.25rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-balance",
        tone === "light" ? "text-foreground" : "text-[oklch(0.99_0_0)]",
        className,
      )}
    >
      {lead}
      {rest ? (
        <span
          className={cn(
            tone === "light"
              ? "text-foreground/45"
              : "text-[oklch(1_0_0_/_0.42)]",
          )}
        >
          {" "}
          {rest}
        </span>
      ) : null}
    </Tag>
  );
}

/**
 * The smaller version of the same idea, used above each visual inside a
 * section rather than at the top of one.
 */
export function VisualCaption({
  lead,
  rest,
  className,
  tone = "light",
}: {
  lead: ReactNode;
  rest?: ReactNode;
  className?: string;
  tone?: "light" | "ink";
}) {
  return (
    <p
      className={cn(
        "max-w-xl text-[clamp(1rem,1.6vw,1.35rem)] leading-[1.35] font-medium tracking-[-0.02em] text-pretty",
        tone === "light" ? "text-foreground" : "text-[oklch(0.99_0_0)]",
        className,
      )}
    >
      {lead}
      {rest ? (
        <span
          className={cn(
            tone === "light"
              ? "text-foreground/50"
              : "text-[oklch(1_0_0_/_0.45)]",
          )}
        >
          {" "}
          {rest}
        </span>
      ) : null}
    </p>
  );
}
