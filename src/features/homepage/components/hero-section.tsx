"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { CtaButton } from "@/features/homepage/components/cta-button";
import { ChatMockup } from "@/features/homepage/components/mockups/chat-mockup";
import { WorkspaceMockup } from "@/features/homepage/components/mockups/workspace-mockup";
import { FRAME } from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The top of the page.
 *
 * Everything above the screenshot arrives on mount in one staggered run, and
 * the screenshot itself arrives last and from further down — it is the largest
 * thing on the page and a large thing that moves as fast as a line of text
 * reads as a jump. The delays are written out rather than driven by a
 * container's `staggerChildren` because the intervals here are uneven on
 * purpose: the headline holds a beat longer than the eyebrow above it.
 *
 * `primaryCta` is a prop for the same reason the nav's is — it is decided on
 * the server so a signed-in visitor is offered their dashboard rather than a
 * sign-up, and a client component cannot import the server component that
 * makes that call. See `auth-cta`.
 */
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.slow, ease: EASE_OUT, delay },
});

export function HeroSection({ primaryCta }: { primaryCta: ReactNode }) {
  return (
    <section className="relative overflow-hidden">
      {/*
        The wash behind the hero.
        Two very soft radial tints in the product's red, kept under 10% so they
        read as light in the room rather than as a gradient someone applied.
        `pointer-events-none` because it covers the buttons.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_92%),transparent_70%),radial-gradient(40%_40%_at_85%_10%,color-mix(in_oklch,var(--ring),transparent_94%),transparent_70%)]"
      />

      <div className={cn(FRAME, "relative px-5 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-20")}>
        <div className="flex flex-col items-center text-center">
          {/* The pill that links on to the section that proves it. */}
          <motion.div {...rise(0)}>
            <Link
              href="#answers"
              className="group inline-flex items-center gap-2 rounded-none border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              <span className="size-1.5 rounded-none bg-primary" />
              Every answer comes with the page it came from
              <ArrowUpRight className="size-3.5 text-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </motion.div>

          <motion.h1
            {...rise(0.09)}
            className="mt-7 max-w-4xl text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[0.97] font-semibold tracking-[-0.045em] text-balance text-foreground"
          >
            Welcome to documents
            <br className="hidden sm:block" /> that answer back.
          </motion.h1>

          <motion.p
            {...rise(0.18)}
            className="mt-6 max-w-[46rem] text-[clamp(1rem,1.7vw,1.25rem)] leading-[1.5] text-pretty text-foreground/55"
          >
            StudyAI turns a PDF, a lecture deck or a Word file into a workspace
            you can actually work in — the page open beside a canvas you can
            draw on, notes that stay with it, tasks that know their deadline,
            and an AI that read the thing and cites where it read it.
          </motion.p>

          <motion.div
            {...rise(0.27)}
            className="mt-9 flex flex-wrap items-center justify-center gap-2.5"
          >
            {primaryCta}
            <CtaButton href="#workspace" tone="outline" size="lg">
              See it work
            </CtaButton>
          </motion.div>

          <motion.p
            {...rise(0.34)}
            className="mt-4 font-mono text-[11px] tracking-[0.06em] text-foreground/35 uppercase"
          >
            No card · Upload one file · The workspace builds itself
          </motion.p>
        </div>

        {/*
          The screenshot, with the chat panel floating clear of its corner.

          Overlapped rather than placed beside it, so the two read as one
          product with a panel pulled forward — the reference does the same
          thing with its command bar, and it is what stops a hero image from
          looking like a slide.
        */}
        <div className="relative mt-14 sm:mt-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.4 }}
          >
            <WorkspaceMockup />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.75 }}
            className="absolute -bottom-8 -left-3 hidden w-[290px] md:block lg:-left-14 lg:w-[330px]"
          >
            <ChatMockup compact />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
