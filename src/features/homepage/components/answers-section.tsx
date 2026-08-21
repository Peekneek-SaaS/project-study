"use client";

import { motion } from "motion/react";
import { ArrowRight, MousePointerClick } from "lucide-react";

import {
  Eyebrow,
  Reveal,
  SectionHeading,
  VisualCaption,
} from "@/features/homepage/components/homepage-primitives";
import { TextLines } from "@/features/homepage/components/mockups/mockup-chrome";
import { FRAME } from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The section that answers the objection.
 *
 * By this point in the page a reader has been told an AI reads their documents,
 * and the thought they are having is the correct one: *how do I know it did not
 * make that up*. So this section does not describe the citation feature — it
 * shows the round trip. A claim, the pages behind it, and the click that opens
 * the document at the page so you can read the sentence yourself.
 *
 * The two halves are deliberately not the same promise, because in the product
 * they are not the same thing. Citations are a preference and ship off — a link
 * hanging off every clause is a lot of furniture in a paragraph you are only
 * reading. The *retrieval* is not a preference and cannot be turned off: an
 * uncited answer is searched and read exactly as hard as a cited one. The left
 * panel sells the switch; the right panel says what happens regardless.
 */
export function AnswersSection() {
  return (
    <section id="answers" className="scroll-mt-16 border-t border-border">
      <div className={FRAME}>
        <div className="px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <Eyebrow>Answers</Eyebrow>
            <SectionHeading
              className="mt-6"
              lead="It never answers from memory."
              rest="Every reply is searched out of your pages first. The receipts are a switch — off while you read, on when you check."
            />
          </Reveal>
        </div>

        <div className="grid border-t border-border lg:grid-cols-2">
          {/* The round trip */}
          <div className="border-b border-border p-5 sm:p-8 lg:border-r lg:border-b-0">
            <Reveal>
              <VisualCaption
                lead="Turn citations on and every claim is a link."
                rest="It opens the document panel at exactly the passage the answer came from — same tab, same scroll position, no hunting for it."
              />
            </Reveal>
            <Reveal className="mt-8" delay={0.1}>
              <CitationRoundTrip />
            </Reveal>
          </div>

          {/* What it does before answering */}
          <div className="p-5 sm:p-8">
            <Reveal>
              <VisualCaption
                lead="This part never switches off."
                rest="Search the passages, read the pages around the hit, search again if the first came back thin. It happens on every answer, cited or not — the citations are the display, never the grounding."
              />
            </Reveal>
            <Reveal className="mt-8" delay={0.1}>
              <ToolTrace />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A citation, and the page it opens.
 *
 * The pointer travels from the chip to the page on a loop — the one animation
 * on the page that repeats, because it is describing an interaction rather
 * than decorating a block, and an interaction shown once is missed by anyone
 * who scrolled past it at speed.
 */
function CitationRoundTrip() {
  return (
    <div className="relative overflow-hidden rounded-none border border-border bg-card">
      <div className="grid sm:grid-cols-2">
        {/* The answer */}
        <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
          <p className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-foreground/30 uppercase">
            The answer
          </p>
          <p className="text-[11px] leading-[1.6] text-foreground/80">
            Water moves into the cell and pressure builds against the membrane
            until it ruptures.
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <motion.span
              animate={{
                borderColor: [
                  "color-mix(in oklch, var(--primary), transparent 75%)",
                  "var(--primary)",
                  "color-mix(in oklch, var(--primary), transparent 75%)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 1] }}
              className="relative rounded-none border bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
            >
              p. 12
              <motion.span
                className="absolute -right-1 -bottom-1"
                animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 0.9, 0.8] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.4, 0.55] }}
              >
                <MousePointerClick className="size-3 text-primary" />
              </motion.span>
            </motion.span>
            <span className="font-mono text-[10px] text-foreground/25">p. 13</span>
            <ArrowRight className="size-3 text-foreground/20" />
          </div>
        </div>

        {/* The page it lands on */}
        <div className="relative bg-muted/40 p-4">
          <p className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-foreground/30 uppercase">
            Page 12, opened
          </p>
          <div className="rounded-none border border-border bg-card p-3">
            <TextLines count={3} className="mb-2" />
            {/* The passage lights up as the pointer lands on the chip. */}
            <motion.div
              animate={{
                backgroundColor: [
                  "rgba(0,0,0,0)",
                  "color-mix(in oklch, var(--primary), transparent 85%)",
                  "color-mix(in oklch, var(--primary), transparent 85%)",
                  "rgba(0,0,0,0)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.8, 1] }}
              className="-mx-1 my-1 px-1 py-1"
            >
              <TextLines count={2} widths={[98, 72]} />
            </motion.div>
            <TextLines count={4} className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The steps a question actually goes through, as the transcript records them.
 *
 * The last row deliberately does not mention citations. It used to read "with 2
 * citations", which was fine when they were always on and is a contradiction
 * now: it sits under a heading promising this happens *whether or not* you
 * asked for them. What the row has to say is that the answer came out of the
 * three steps above it, and that is true in both modes.
 */
const TRACE = [
  { step: "Searched", detail: "“osmosis semipermeable membrane”", meta: "8 passages" },
  { step: "Read pages", detail: "11–13, in order", meta: "~2,400 words" },
  { step: "Searched again", detail: "“lysis turgor cell wall”", meta: "5 passages" },
  { step: "Answered", detail: "only from what it read", meta: "nothing invented", accent: true },
] as const;

function ToolTrace() {
  return (
    <div className="rounded-none border border-border bg-card">
      {TRACE.map((row, index) => (
        <motion.div
          key={row.step}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: index * 0.18 }}
          className={cn(
            "flex items-center gap-3 border-b border-border px-3.5 py-3 last:border-b-0",
            "accent" in row && row.accent ? "bg-primary/[0.04]" : "",
          )}
        >
          {/* The rail down the left — a step marker, and the line to the next. */}
          <span className="relative flex size-4 shrink-0 items-center justify-center">
            <span
              className={cn(
                "size-1.5 rounded-none",
                "accent" in row && row.accent ? "bg-primary" : "bg-foreground/25",
              )}
            />
            {index < TRACE.length - 1 ? (
              <span className="absolute top-1/2 left-1/2 h-[38px] w-px -translate-x-1/2 bg-border" />
            ) : null}
          </span>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[12px] font-medium",
                "accent" in row && row.accent ? "text-primary" : "text-foreground/85",
              )}
            >
              {row.step}
            </p>
            <p className="truncate text-[11px] text-foreground/40">{row.detail}</p>
          </div>

          <span className="shrink-0 font-mono text-[10px] text-foreground/30">
            {row.meta}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
