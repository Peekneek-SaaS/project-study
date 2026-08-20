"use client";

import { motion } from "motion/react";
import { Bold, Grid2x2, Link2, Palette, Type } from "lucide-react";

import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The notes wall.
 *
 * Grouped by the day they were written, newest first — which is exactly how
 * the real grid orders itself, and why the schema indexes notes on `createdAt`
 * rather than `updatedAt`: editing an old note leaves it under the date it was
 * written, so "Yesterday" keeps meaning yesterday.
 *
 * The colours are the ones the product ships: a note carries its own paper
 * colour, ink colour, family and size. Rendered here as tinted squares so the
 * wall reads as a wall rather than as a list of cards.
 */
const NOTES = [
  {
    day: "Today",
    items: [
      {
        tint: "bg-[oklch(0.94_0.075_85)]",
        ink: "text-[oklch(0.32_0.06_60)]",
        title: "Osmosis ≠ diffusion",
        body: "Osmosis is water only, and only across a semipermeable membrane. Diffusion is any solute.",
        tag: "p. 12",
      },
      {
        tint: "bg-[oklch(0.93_0.055_155)]",
        ink: "text-[oklch(0.3_0.05_155)]",
        title: "Exam trap",
        body: "They always ask about plant cells. Wall holds pressure → turgid, not burst.",
        tag: "p. 13",
      },
      {
        tint: "bg-[oklch(0.93_0.05_255)]",
        ink: "text-[oklch(0.3_0.05_255)]",
        title: "Ask in seminar",
        body: "Does aquaporin density change the rate, or only the ceiling?",
        tag: null,
      },
    ],
  },
  {
    day: "Yesterday",
    items: [
      {
        tint: "bg-[oklch(0.93_0.05_25)]",
        ink: "text-[oklch(0.33_0.06_25)]",
        title: "Isotonic ≈ no net flow",
        body: "Still moving both ways — net zero, not stopped. Wording matters.",
        tag: "p. 11",
      },
      {
        tint: "bg-[oklch(0.94_0.04_310)]",
        ink: "text-[oklch(0.32_0.05_310)]",
        title: "Redo Fig 4.3",
        body: "Copy the arrows onto the board before the test.",
        tag: null,
      },
    ],
  },
] as const;

export function NotesMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-none border border-border bg-card",
        className,
      )}
    >
      {/* The formatting bar a note gets when it is open */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border bg-muted/50 px-2.5">
        {[Bold, Type, Palette, Link2, Grid2x2].map((Icon, index) => (
          <span
            key={index}
            className={cn(
              "grid size-5 place-items-center rounded-none",
              index === 2 ? "bg-background text-foreground" : "text-foreground/40",
            )}
          >
            <Icon className="size-3" />
          </span>
        ))}
        <span className="ml-auto font-mono text-[9.5px] text-foreground/35">
          5 notes · this document
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4">
        {NOTES.map((group) => (
          <div key={group.day}>
            <p className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-foreground/30 uppercase">
              {group.day}
            </p>
            <motion.div
              variants={listContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {group.items.map((note) => (
                <motion.div
                  key={note.title}
                  variants={listItem}
                  className={cn(
                    "flex flex-col gap-1 rounded-none border border-black/5 p-2.5 shadow-sm",
                    note.tint,
                  )}
                >
                  <p className={cn("text-[10.5px] font-semibold", note.ink)}>
                    {note.title}
                  </p>
                  <p className={cn("text-[9.5px] leading-[1.45] opacity-70", note.ink)}>
                    {note.body}
                  </p>
                  {note.tag ? (
                    <span
                      className={cn(
                        "mt-auto w-fit rounded-none bg-black/8 px-1 py-px font-mono text-[8.5px]",
                        note.ink,
                      )}
                    >
                      {note.tag}
                    </span>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
