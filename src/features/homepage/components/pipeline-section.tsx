"use client";

import { motion } from "motion/react";
import { UploadCloud } from "lucide-react";

import {
  Eyebrow,
  Reveal,
  SectionHeading,
} from "@/features/homepage/components/homepage-primitives";
import { FRAME, REVEAL_VIEWPORT_TALL } from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * What happens between dropping a file and having a workspace.
 *
 * Worth a diagram rather than a paragraph, because the shape of it is the
 * interesting part: one upload starts *two* independent jobs. One builds the
 * workspace — the board, the notes, the surfaces you touch. The other reads the
 * document — the title, the subject, the outline, the passages the AI searches.
 *
 * They are drawn as two tracks because that is what they are in the database:
 * `DocumentStatus` and `ContentStatus` are separate columns on purpose, since a
 * document whose workspace built fine can still be unreadable to the model, and
 * one the model read perfectly can have had its board build wedge. Folding them
 * into a single bar would hide exactly the failure the split exists to surface.
 */
export function PipelineSection() {
  return (
    <section id="pipeline" className="scroll-mt-16 border-t border-border">
      <div className={FRAME}>
        <div className="px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <SectionHeading
              className="mt-6"
              lead="Drop the file. Walk away."
              rest="One upload starts two jobs: one builds the workspace, the other reads the document. Neither needs you."
            />
          </Reveal>
        </div>

        <div className="border-t border-border bg-[radial-gradient(var(--border)_1px,transparent_1px)] px-5 py-12 [background-size:18px_18px] sm:px-8 sm:py-16">
          <Reveal viewport={REVEAL_VIEWPORT_TALL}>
            {/* Horizontal scroll on small screens rather than a reflow: a node
                graph that wraps is no longer a node graph. */}
            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
              <PipelineDiagram />
            </div>
            {/* Only where the diagram is actually wider than the screen. */}
            <p className="mt-3 text-center font-mono text-[10px] tracking-[0.1em] text-foreground/30 uppercase sm:hidden">
              Scroll the diagram →
            </p>
          </Reveal>

          <Reveal className="mt-10" delay={0.15}>
            <p className="mx-auto max-w-2xl text-center text-[13.5px] leading-relaxed text-foreground/45">
              Both tracks report where they got to, and they fail separately —
              so a board that built fine never hides a reading that did not, and
              you always know which half to retry.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Node geometry, kept in one place so the connectors cannot drift from the boxes. */
const NODE_W = 138;
const NODE_H = 52;

const TRACK_A = [
  { x: 250, label: "Queued", note: "job accepted" },
  { x: 430, label: "Building", note: "board + notes" },
  { x: 610, label: "Ready", note: "workspace open", accent: true },
] as const;

const TRACK_B = [
  { x: 250, label: "Processing", note: "text extracted" },
  { x: 430, label: "Understood", note: "title · subject · outline" },
  { x: 610, label: "Searchable", note: "passages, with pages", accent: true },
] as const;

const TRACK_A_Y = 52;
const TRACK_B_Y = 190;

function PipelineDiagram() {
  /** A connector that draws itself, then hands off to the next one. */
  const wire = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true, amount: 0.2 },
    transition: {
      pathLength: { duration: 0.5, ease: EASE_OUT, delay },
      opacity: { duration: 0.15, delay },
    },
  });

  /** A node that lands once the wire reaching it has arrived. */
  const node = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: DURATION.base, ease: EASE_OUT, delay },
  });

  return (
    <svg
      viewBox="0 0 800 280"
      className="h-auto w-full min-w-[760px]"
      fill="none"
      role="img"
      aria-label="One upload starts two independent jobs: building the workspace, and reading the document."
    >
      {/* ---- The file, where both tracks start ---- */}
      <motion.g {...node(0)}>
        <rect
          x="10" y={(TRACK_A_Y + TRACK_B_Y) / 2 + 4} width={NODE_W} height={NODE_H}
          fill="var(--card)" stroke="var(--foreground)" strokeOpacity="0.85" strokeWidth="1.5"
        />
        <foreignObject x="10" y={(TRACK_A_Y + TRACK_B_Y) / 2 + 4} width={NODE_W} height={NODE_H}>
          <div className="flex h-full flex-col justify-center gap-0.5 px-3">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
              <UploadCloud className="size-3.5 text-primary" />
              Your file
            </span>
            <span className="font-mono text-[9.5px] text-foreground/40">
              bio-ch4-final-v2.pdf
            </span>
          </div>
        </foreignObject>
      </motion.g>

      {/* ---- The fan-out ---- */}
      <motion.path
        d={`M${10 + NODE_W} ${(TRACK_A_Y + TRACK_B_Y) / 2 + 30} H200 V${TRACK_A_Y + NODE_H / 2} H${TRACK_A[0].x - 6}`}
        stroke="var(--foreground)" strokeOpacity="0.28" strokeWidth="1.5"
        {...wire(0.25)}
      />
      <motion.path
        d={`M${10 + NODE_W} ${(TRACK_A_Y + TRACK_B_Y) / 2 + 30} H200 V${TRACK_B_Y + NODE_H / 2} H${TRACK_B[0].x - 6}`}
        stroke="var(--foreground)" strokeOpacity="0.28" strokeWidth="1.5"
        {...wire(0.25)}
      />

      {/* ---- Track labels ---- */}
      <motion.g {...node(0.3)}>
        <text x="206" y={TRACK_A_Y - 14} fontSize="9.5" letterSpacing="1.4"
          fill="var(--foreground)" fillOpacity="0.32" fontFamily="var(--font-mono)">
          TRACK 1 — BUILD THE WORKSPACE
        </text>
        <text x="206" y={TRACK_B_Y - 14} fontSize="9.5" letterSpacing="1.4"
          fill="var(--foreground)" fillOpacity="0.32" fontFamily="var(--font-mono)">
          TRACK 2 — READ THE DOCUMENT
        </text>
      </motion.g>

      {/* ---- The two tracks ---- */}
      {[
        { steps: TRACK_A, y: TRACK_A_Y, base: 0.45 },
        { steps: TRACK_B, y: TRACK_B_Y, base: 0.45 },
      ].map((track) =>
        track.steps.map((step, index) => (
          <g key={`${track.y}-${step.label}`}>
            {index > 0 ? (
              <motion.path
                d={`M${track.steps[index - 1].x + NODE_W} ${track.y + NODE_H / 2} H${step.x - 6}`}
                stroke="var(--foreground)" strokeOpacity="0.28" strokeWidth="1.5"
                {...wire(track.base + index * 0.35)}
              />
            ) : null}
            {/* Arrowhead */}
            <motion.path
              d={`M${step.x - 12} ${track.y + NODE_H / 2 - 4} L${step.x - 6} ${track.y + NODE_H / 2} L${step.x - 12} ${track.y + NODE_H / 2 + 4}`}
              stroke="var(--foreground)" strokeOpacity="0.28" strokeWidth="1.5"
              {...wire(track.base + index * 0.35 + 0.1)}
            />
            <motion.g {...node(track.base + index * 0.35 + 0.15)}>
              <rect
                x={step.x} y={track.y} width={NODE_W} height={NODE_H}
                fill="var(--card)"
                stroke={"accent" in step && step.accent ? "var(--primary)" : "var(--border)"}
                strokeWidth={"accent" in step && step.accent ? 1.6 : 1.2}
              />
              <foreignObject x={step.x} y={track.y} width={NODE_W} height={NODE_H}>
                <div className="flex h-full flex-col justify-center gap-0.5 px-3">
                  <span
                    className={
                      "accent" in step && step.accent
                        ? "text-[12px] font-semibold text-primary"
                        : "text-[12px] font-semibold text-foreground/80"
                    }
                  >
                    {step.label}
                  </span>
                  <span className="text-[9.5px] text-foreground/40">
                    {step.note}
                  </span>
                </div>
              </foreignObject>
            </motion.g>
          </g>
        )),
      )}

      {/* ---- The two tracks meeting at the workspace ---- */}
      <motion.path
        d={`M${610 + NODE_W} ${TRACK_A_Y + NODE_H / 2} H744 V${(TRACK_A_Y + TRACK_B_Y) / 2 + 30} H770`}
        stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.5"
        {...wire(1.6)}
      />
      <motion.path
        d={`M${610 + NODE_W} ${TRACK_B_Y + NODE_H / 2} H744 V${(TRACK_A_Y + TRACK_B_Y) / 2 + 30} H770`}
        stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.5"
        {...wire(1.6)}
      />
      <motion.g {...node(1.85)}>
        <circle cx="778" cy={(TRACK_A_Y + TRACK_B_Y) / 2 + 30} r="7" fill="var(--primary)" />
        <text
          x="778" y={(TRACK_A_Y + TRACK_B_Y) / 2 + 56} textAnchor="middle"
          fontSize="9.5" fill="var(--primary)" fontFamily="var(--font-mono)"
        >
          READY
        </text>
      </motion.g>
    </svg>
  );
}
