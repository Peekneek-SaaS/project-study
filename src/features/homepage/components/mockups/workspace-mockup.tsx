"use client";

import { motion } from "motion/react";
import {
  FileText,
  ListTodo,
  MessageSquare,
  Minus,
  Shapes,
  StickyNote,
} from "lucide-react";

import {
  MockPill,
  MockupWindow,
  TextLines,
} from "@/features/homepage/components/mockups/mockup-chrome";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The hero's screenshot: the real `/work` split, at a quarter of the type size.
 *
 * Laid out the way `WorkWorkspace` actually lays out — document panel on the
 * left, a resize handle, and the sections panel on the right behind a tab bar
 * of Board / Notes / Tasks / Chat. Getting this right matters more than it
 * looks: the hero image is the promise, and a promise that does not match the
 * product on first login is worse than no image at all.
 */
const TABS = [
  { icon: Shapes, label: "Board", active: true },
  { icon: StickyNote, label: "Notes", active: false },
  { icon: ListTodo, label: "Tasks", active: false },
  { icon: MessageSquare, label: "Chat", active: false },
] as const;

export function WorkspaceMockup({ className }: { className?: string }) {
  return (
    <MockupWindow
      className={cn("h-[420px] sm:h-[480px]", className)}
      title="Cell Structure and Function — StudyAI"
      toolbar={
        <>
          <MockPill>Saved</MockPill>
          <Minus className="size-3 text-foreground/30" />
        </>
      }
    >
      <div className="flex h-full">
        {/* ---- The document panel ---- */}
        <div className="hidden w-[38%] shrink-0 flex-col border-r border-border sm:flex">
          <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-2">
            <span className="flex items-center gap-1 text-[10px] font-medium text-foreground/60">
              <FileText className="size-3" />
              bio-ch4-final-v2.pdf
            </span>
            <span className="font-mono text-[9.5px] text-foreground/35">12 / 34</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-muted/40 p-3">
            <div className="h-full rounded-none border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 h-[5px] w-[62%] rounded-none bg-foreground/25" />
              <TextLines count={5} className="mb-3" />
              {/* The highlighted passage — what a citation points back at. */}
              <motion.div
                initial={{ backgroundColor: "rgba(0,0,0,0)" }}
                animate={{ backgroundColor: "color-mix(in oklch, var(--primary), transparent 88%)" }}
                transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 1.1 }}
                className="-mx-1 mb-3 rounded-none px-1 py-1"
              >
                <TextLines count={3} widths={[97, 93, 64]} />
              </motion.div>
              <TextLines count={6} />
            </div>
          </div>
        </div>

        {/* ---- The sections panel ---- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border px-1.5">
            {TABS.map((tab) => (
              <span
                key={tab.label}
                className={cn(
                  "inline-flex items-center gap-1 rounded-none px-1.5 py-1 text-[10px] font-medium",
                  tab.active
                    ? "bg-muted text-foreground"
                    : "text-foreground/45",
                )}
              >
                <tab.icon className="size-3" />
                {tab.label}
              </span>
            ))}
          </div>

          {/* The canvas, drawn on. */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:14px_14px]">
            <BoardScene />
          </div>
        </div>
      </div>
    </MockupWindow>
  );
}

/**
 * The board, mid-diagram.
 *
 * The strokes draw themselves in on mount with `pathLength`, which is the one
 * animation on this page that is doing real work rather than decoration: a
 * still canvas reads as a picture *of* a whiteboard, and a canvas whose lines
 * arrive reads as one someone is using. Anyone who has asked for reduced
 * motion gets the finished drawing without the drawing — `MotionProvider` sets
 * `reducedMotion="user"` app-wide and strips the transforms.
 */
function BoardScene() {
  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { duration: 1.1, ease: EASE_OUT, delay },
      opacity: { duration: 0.2, delay },
    },
  });

  return (
    <svg
      viewBox="0 0 320 220"
      className="absolute inset-0 size-full"
      fill="none"
      aria-hidden
    >
      {/* Nucleus */}
      <motion.circle
        cx="160" cy="105" r="34"
        stroke="var(--foreground)" strokeWidth="1.4" strokeOpacity="0.75"
        {...draw(0.35)}
      />
      <motion.circle
        cx="160" cy="105" r="13"
        stroke="var(--primary)" strokeWidth="1.4"
        {...draw(0.75)}
      />
      {/* Membrane */}
      <motion.ellipse
        cx="160" cy="108" rx="120" ry="76"
        stroke="var(--foreground)" strokeWidth="1.4" strokeOpacity="0.35"
        strokeDasharray="4 4"
        {...draw(0.1)}
      />
      {/* Leader lines out to labels */}
      <motion.path
        d="M126 88 L74 58" stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="1.2"
        {...draw(1.15)}
      />
      <motion.path
        d="M194 122 L250 156" stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="1.2"
        {...draw(1.35)}
      />
      {/* Hand-written labels */}
      <motion.g
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 1.5 }}
      >
        <rect x="28" y="46" width="52" height="15" fill="var(--card)" stroke="var(--border)" />
        <text x="34" y="57" fontSize="9" fill="var(--foreground)" fillOpacity="0.75" fontFamily="var(--font-sans)">
          nucleus
        </text>
      </motion.g>
      <motion.g
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 1.7 }}
      >
        <rect x="248" y="148" width="62" height="15" fill="var(--card)" stroke="var(--primary)" strokeOpacity="0.4" />
        <text x="254" y="159" fontSize="9" fill="var(--primary)" fontFamily="var(--font-sans)">
          p. 12 ↗
        </text>
      </motion.g>
    </svg>
  );
}
