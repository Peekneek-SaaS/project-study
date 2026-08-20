"use client";

import { motion } from "motion/react";
import {
  Circle,
  Eraser,
  Hand,
  MousePointer2,
  Pencil,
  Square,
  Type,
} from "lucide-react";

import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The canvas that opens beside the page.
 *
 * A real Excalidraw scene lives behind this in the product — the board is
 * stored per document and saves itself — so the mock shows the toolbar it
 * actually has rather than a generic drawing area. The strokes draw themselves
 * in on scroll, which is the difference between showing a whiteboard and
 * showing someone using one.
 */
const TOOLS = [
  { icon: Hand, active: false },
  { icon: MousePointer2, active: false },
  { icon: Square, active: false },
  { icon: Circle, active: false },
  { icon: Pencil, active: true },
  { icon: Type, active: false },
  { icon: Eraser, active: false },
] as const;

export function BoardMockup({ className }: { className?: string }) {
  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true, amount: 0.3 },
    transition: {
      pathLength: { duration: 1.2, ease: EASE_OUT, delay },
      opacity: { duration: 0.2, delay },
    },
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-none border border-border bg-card",
        className,
      )}
    >
      {/* Dotted canvas ground */}
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Floating toolbar, where Excalidraw puts it */}
      <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-none border border-border bg-card p-1 shadow-md">
        {TOOLS.map((tool, index) => (
          <span
            key={index}
            className={cn(
              "grid size-6 place-items-center rounded-none",
              tool.active
                ? "bg-primary text-primary-foreground"
                : "text-foreground/45",
            )}
          >
            <tool.icon className="size-3" />
          </span>
        ))}
      </div>

      {/* Saved indicator — the board writes itself back on its own */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: DURATION.base, delay: 1.2 }}
        className="absolute top-3 right-3 z-10 rounded-none border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] text-foreground/45"
      >
        Saved · just now
      </motion.div>

      <svg
        viewBox="0 0 900 340"
        className="relative size-full"
        fill="none"
        aria-hidden
      >
        {/* The flow the reader is working out: hypotonic → water in → lysis */}
        <motion.rect
          x="50" y="70" width="190" height="66"
          stroke="var(--foreground)" strokeOpacity="0.7" strokeWidth="1.6"
          {...draw(0.1)}
        />
        <motion.rect
          x="355" y="70" width="190" height="66"
          stroke="var(--foreground)" strokeOpacity="0.7" strokeWidth="1.6"
          {...draw(0.45)}
        />
        <motion.rect
          x="660" y="70" width="190" height="66"
          stroke="var(--primary)" strokeWidth="1.8"
          {...draw(0.8)}
        />
        <motion.path d="M240 103 H349" stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(0.35)} />
        <motion.path d="M341 97 L351 103 L341 109" stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(0.4)} />
        <motion.path d="M545 103 H654" stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(0.7)} />
        <motion.path d="M646 97 L656 103 L646 109" stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(0.75)} />

        {/* An underline scribbled under the conclusion */}
        <motion.path
          d="M668 152 C 706 145, 792 160, 846 150"
          stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round"
          {...draw(1.3)}
        />

        <motion.g
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 1.1 }}
        >
          <text x="72" y="100" fontSize="15" fill="var(--foreground)" fillOpacity="0.82" fontFamily="var(--font-sans)">hypotonic</text>
          <text x="72" y="120" fontSize="12" fill="var(--foreground)" fillOpacity="0.42" fontFamily="var(--font-sans)">low solute outside</text>
          <text x="377" y="100" fontSize="15" fill="var(--foreground)" fillOpacity="0.82" fontFamily="var(--font-sans)">water enters</text>
          <text x="377" y="120" fontSize="12" fill="var(--foreground)" fillOpacity="0.42" fontFamily="var(--font-sans)">down the gradient</text>
          <text x="682" y="100" fontSize="15" fill="var(--primary)" fontFamily="var(--font-sans)">lysis</text>
          <text x="682" y="120" fontSize="12" fill="var(--foreground)" fillOpacity="0.42" fontFamily="var(--font-sans)">membrane fails</text>
        </motion.g>

        {/*
          The cell, sketched underneath the working.

          The membrane fades in rather than drawing itself, which is the one
          exception on this canvas and a forced one: animating `pathLength`
          works by writing `stroke-dasharray`, so a path that wants its own
          dashes cannot also draw itself on — Motion's value wins and the
          membrane comes out solid. A dashed membrane matters more here than a
          drawn one, since it is what says "semipermeable".
        */}
        <motion.ellipse
          cx="450" cy="252" rx="118" ry="62"
          stroke="var(--foreground)" strokeOpacity="0.32" strokeWidth="1.6" strokeDasharray="5 5"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 1.4 }}
        />
        <motion.circle cx="450" cy="252" r="30" stroke="var(--foreground)" strokeOpacity="0.55" strokeWidth="1.6" {...draw(1.7)} />
        <motion.circle cx="450" cy="252" r="11" stroke="var(--primary)" strokeOpacity="0.7" strokeWidth="1.6" {...draw(1.85)} />
        {/* Arrows of water crossing the membrane */}
        <motion.path d="M262 252 H316" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(2)} />
        <motion.path d="M308 246 L318 252 L308 258" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(2.05)} />
        <motion.path d="M638 252 H584" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(2)} />
        <motion.path d="M592 246 L582 252 L592 258" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.6" {...draw(2.05)} />
        <motion.g
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 2.2 }}
        >
          <text x="450" y="332" textAnchor="middle" fontSize="12" fill="var(--foreground)" fillOpacity="0.4" fontFamily="var(--font-sans)">
            water in from both sides — pressure builds
          </text>
        </motion.g>
      </svg>
    </div>
  );
}
