"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { CtaButton } from "@/features/homepage/components/cta-button";
import { Reveal } from "@/features/homepage/components/homepage-primitives";
import {
  INK,
  INK_BORDER,
  INK_MUTED,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "@/features/homepage/lib/design";
import { cn } from "@/lib/utils";

/**
 * The last thing before the footer.
 *
 * Nothing new is argued here — anyone still reading has been convinced or has
 * not. So it is one line, two buttons, and a great deal of quiet around them.
 * The vertical hairlines behind it are the page's own grid, brought forward one
 * last time so the closing band belongs to the same drawing as the rest.
 */
export function FinalCtaSection() {
  return (
    <section className={cn("relative overflow-hidden border-t", INK, INK_BORDER)}>
      {/* The comb of vertical rules — the reference closes on the same figure. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_right,oklch(1_0_0_/_0.045)_0px,oklch(1_0_0_/_0.045)_1px,transparent_1px,transparent_44px)]"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[280px] bg-[radial-gradient(50%_100%_at_50%_100%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_70%)]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
      />

      <div className={cn("relative mx-auto w-full max-w-[1280px] border-x", INK_BORDER)}>
        <div className="flex flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-32">
          <Reveal>
            <h2 className="max-w-3xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance text-[oklch(0.99_0_0)]">
              Your next document
              <br className="hidden sm:block" /> deserves better than a tab.
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={cn("mt-6 max-w-xl text-[15px] leading-relaxed", INK_MUTED)}>
              Upload one file and watch the workspace build itself around it.
              It takes about a minute, and you will know by the end of it.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
              <CtaButton href={SIGN_UP_PATH} tone="inkSolid" size="lg">
                Start for free
                <ArrowRight />
              </CtaButton>
              <CtaButton href={SIGN_IN_PATH} tone="inkOutline" size="lg">
                Sign in
              </CtaButton>
            </div>
          </Reveal>

          <Reveal delay={0.28}>
            <p className="mt-5 font-mono text-[11px] tracking-[0.08em] text-[oklch(1_0_0_/_0.3)] uppercase">
              No card required
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
