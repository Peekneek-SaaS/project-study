"use client";

import { motion } from "motion/react";
import {
  FileSearch,
  Layers,
  Library,
  ListTree,
  Tag,
} from "lucide-react";

import {
  Eyebrow,
  Reveal,
  RevealGroup,
  RevealItem,
  SectionHeading,
} from "@/features/homepage/components/homepage-primitives";
import {
  INK,
  INK_BORDER,
  INK_FAINT,
  INK_MUTED,
} from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The page goes black here, and the claim gets bigger.
 *
 * Everything above this point is things the user does. This is the one section
 * about what the *product* did while they were not looking, and it is the
 * hardest thing to show — there is no screenshot of comprehension. So it gets
 * the change of register instead: an inverted band, the largest type on the
 * page, and a diagram of what was pulled out of the file.
 *
 * Every claim in here is something the schema actually stores. The renamed
 * title is the clearest of them and it is worth leading on, because it is the
 * moment a reader realises the thing has been read rather than indexed.
 */
const FACETS = [
  {
    icon: Tag,
    title: "It knows its real name.",
    body: "You called it bio-ch4-final-v2.pdf. It is called Cell Structure and Function, and that is what a citation says.",
  },
  {
    icon: Library,
    title: "It knows the subject.",
    body: "Biology, not “document 4”. Which is how it tells three chapter fours apart when you ask across everything.",
  },
  {
    icon: ListTree,
    title: "It maps the outline.",
    body: "Chapters and sections with the pages they run over — so “the bit about transport” is a place, not a search.",
  },
  {
    icon: Layers,
    title: "It cuts on meaning.",
    body: "Passages span page breaks, because paragraphs do. A thought that starts on 4 and ends on 5 stays one thought.",
  },
  {
    icon: FileSearch,
    title: "It searches the lot.",
    body: "One question can go across every document you have ever uploaded, and come back knowing which one answered.",
  },
] as const;

export function ComprehensionSection() {
  return (
    <section className={cn("border-t", INK, INK_BORDER)}>
      <div className={cn("mx-auto w-full max-w-[1280px] border-x", INK_BORDER)}>
        {/* The statement, and the diagram of what it means */}
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-16 sm:px-8 sm:py-24">
            <Reveal>
              <Eyebrow tone="ink">Comprehension</Eyebrow>
              <SectionHeading
                tone="ink"
                className="mt-6"
                lead="It read the thing."
                rest="Not the filename. Not the first page. The whole document, before you asked it anything."
              />
              <p className={cn("mt-7 max-w-md text-[14.5px] leading-relaxed", INK_MUTED)}>
                Most tools stuff your PDF into a prompt and hope. This one pulls
                the document apart first — what it is, what it covers, how it is
                laid out, and where every passage sits — and keeps all of it. The
                answer you get later is built out of that, which is why it can
                tell you the page.
              </p>
            </Reveal>
          </div>

          <div className={cn("border-t lg:border-t-0 lg:border-l", INK_BORDER)}>
            <ExtractionDiagram />
          </div>
        </div>

        {/* The bordered icon row — the reference's five-across, at this page's scale */}
        <RevealGroup className={cn("grid border-t sm:grid-cols-2 lg:grid-cols-5", INK_BORDER)}>
          {FACETS.map((facet, index) => (
            <RevealItem
              key={facet.title}
              className={cn(
                "flex flex-col gap-3 border-b p-6 last:border-b-0 sm:border-b lg:border-b-0",
                INK_BORDER,
                // Vertical rules between the cells, dropped at the end of each
                // row so the band's own edge is not doubled.
                "sm:[&:nth-child(2n+1)]:border-r lg:[&:nth-child(2n+1)]:border-r-0 lg:border-r lg:last:border-r-0",
                index >= 3 ? "sm:border-b-0" : "",
              )}
            >
              <facet.icon className="size-4 text-[oklch(0.78_0.16_31)]" />
              <p className="text-[14px] leading-snug font-medium text-[oklch(0.99_0_0)]">
                {facet.title}
              </p>
              <p className={cn("text-[12.5px] leading-relaxed", INK_FAINT)}>
                {facet.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/**
 * The document in the middle, and what came out of it.
 *
 * Rings rather than a list, because the point is that these are all facets of
 * one thing read once — a list would read as five separate features. The chips
 * drift very slightly and forever, which keeps the diagram alive without ever
 * asking to be watched; the rings themselves rotate at a pace you have to look
 * for to notice.
 */
const CHIPS = [
  { label: "Cell Structure and Function", tone: "title", top: "9%", left: "10%" },
  { label: "Biology", tone: "quiet", top: "24%", right: "9%" },
  { label: "34 pages", tone: "quiet", bottom: "30%", left: "7%" },
  { label: "§4.2 Osmosis · pp. 11–14", tone: "accent", bottom: "11%", right: "7%" },
  { label: "128 passages", tone: "quiet", top: "47%", left: "4%" },
] as const;

function ExtractionDiagram() {
  return (
    <div className="relative h-[380px] overflow-hidden sm:h-[440px]">
      {/* Concentric rings */}
      <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      >
        {[300, 220, 140].map((size, index) => (
          <motion.div
            key={size}
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
              INK_BORDER,
            )}
            style={{ width: size, height: size }}
            animate={{ rotate: index % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 90 + index * 30, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </motion.div>

      {/* The document itself */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.15 }}
        className="absolute top-1/2 left-1/2 flex size-[86px] -translate-x-1/2 -translate-y-1/2 flex-col justify-center gap-[3px] border border-[oklch(1_0_0_/_0.2)] bg-[oklch(0.22_0.004_106)] p-3 shadow-2xl"
      >
        {[100, 88, 96, 70].map((width, index) => (
          <span
            key={index}
            className="block h-[3px] bg-[oklch(1_0_0_/_0.28)]"
            style={{ width: `${width}%` }}
          />
        ))}
        <span className="mt-1 font-mono text-[8px] text-[oklch(1_0_0_/_0.35)]">
          PDF
        </span>
      </motion.div>

      {/* What was read out of it */}
      {CHIPS.map((chip, index) => (
        <motion.div
          key={chip.label}
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: DURATION.base,
            ease: EASE_OUT,
            delay: 0.45 + index * 0.12,
          }}
          className="absolute"
          style={{
            top: "top" in chip ? chip.top : undefined,
            left: "left" in chip ? chip.left : undefined,
            right: "right" in chip ? chip.right : undefined,
            bottom: "bottom" in chip ? chip.bottom : undefined,
          }}
        >
          <motion.span
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 5 + index,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.4,
            }}
            className={cn(
              "inline-block border px-2 py-1 text-[11px] whitespace-nowrap backdrop-blur-sm",
              chip.tone === "title" &&
                "border-[oklch(1_0_0_/_0.2)] bg-[oklch(1_0_0_/_0.08)] font-medium text-[oklch(0.99_0_0)]",
              chip.tone === "accent" &&
                "border-[oklch(0.7_0.18_31_/_0.4)] bg-[oklch(0.7_0.18_31_/_0.14)] font-mono text-[oklch(0.83_0.14_31)]",
              chip.tone === "quiet" &&
                cn("bg-[oklch(1_0_0_/_0.04)]", INK_BORDER, INK_MUTED),
            )}
          >
            {chip.label}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}
