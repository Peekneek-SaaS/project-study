"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, PictureInPicture2, Search, ZoomIn } from "lucide-react";

import {
  MockPill,
  TextLines,
} from "@/features/homepage/components/mockups/mockup-chrome";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The document, as the left panel renders it.
 *
 * The page rail down the side is the part worth showing: the reader keeps its
 * place in a 300-page book, and the thumbnail strip is how you get back to
 * something you half-remember seeing. Page 12 is current here and stays
 * current across the rest of the page's mocks — the citation in the chat, the
 * label on the board and the note all point at the same page of the same
 * document, because on the real thing they would.
 */
export function ReaderMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-none border border-border bg-card",
        className,
      )}
    >
      {/* Page rail */}
      <div className="hidden w-16 shrink-0 flex-col gap-1.5 border-r border-border bg-muted/40 p-2 sm:flex">
        {[10, 11, 12, 13, 14].map((page) => (
          <div key={page} className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                "h-[42px] w-full rounded-none border bg-card p-1",
                page === 12
                  ? "border-primary shadow-sm"
                  : "border-border opacity-60",
              )}
            >
              <TextLines count={5} className="scale-y-90" />
            </div>
            <span
              className={cn(
                "font-mono text-[8.5px]",
                page === 12 ? "text-primary" : "text-foreground/30",
              )}
            >
              {page}
            </span>
          </div>
        ))}
      </div>

      {/* The page itself */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2.5">
          <div className="flex items-center gap-1.5">
            <ChevronLeft className="size-3 text-foreground/30" />
            <span className="font-mono text-[10px] text-foreground/55">12 / 34</span>
            <ChevronRight className="size-3 text-foreground/55" />
          </div>
          <div className="flex items-center gap-1.5">
            <MockPill><Search className="size-2.5" />Find</MockPill>
            <MockPill><ZoomIn className="size-2.5" />120%</MockPill>
            <MockPill><PictureInPicture2 className="size-2.5" />Float</MockPill>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-muted/40 p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT }}
            className="mx-auto h-full max-w-[420px] rounded-none border border-border bg-card p-5 shadow-sm"
          >
            <p className="mb-1 font-mono text-[9px] tracking-[0.1em] text-foreground/30 uppercase">
              Chapter 4 · Transport across membranes
            </p>
            <div className="mb-3 h-[6px] w-[70%] rounded-none bg-foreground/30" />
            <TextLines count={4} className="mb-3" />
            <div className="mb-3 h-[4px] w-[38%] rounded-none bg-foreground/20" />
            <TextLines count={3} className="mb-3" />
            {/* A figure, because textbooks have them and a page of pure bars
                reads as a wireframe rather than as a page. */}
            <div className="mb-3 flex h-16 items-center justify-center rounded-none border border-dashed border-border bg-muted/50">
              <span className="font-mono text-[9px] text-foreground/30">
                Fig 4.3 — osmosis
              </span>
            </div>
            <TextLines count={4} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
