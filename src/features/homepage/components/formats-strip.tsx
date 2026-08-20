"use client";

import { motion } from "motion/react";
import {
  FileSpreadsheet,
  FileText,
  Highlighter,
  Presentation,
  ScanLine,
  ScrollText,
} from "lucide-react";

import { FRAME, REVEAL_VIEWPORT } from "@/features/homepage/lib/design";
import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The band under the hero: what you are allowed to bring.
 *
 * Stands where the reference puts its customer logos, and does the same job by
 * different means. This product has no logos to show yet, and a wall of
 * invented ones would be a lie told in the first screen — so it answers the
 * question a visitor actually has at this point in the page, which is "will it
 * take *my* file".
 *
 * A hard-ruled grid with no gaps between the cells: the borders collapse into
 * single hairlines, which is the look the whole page is built on.
 */
const FORMATS = [
  { icon: FileText, label: "PDF", note: "Textbooks, papers" },
  { icon: ScrollText, label: "Word", note: ".docx handouts" },
  { icon: Presentation, label: "PowerPoint", note: "Lecture decks" },
  { icon: ScanLine, label: "Scans", note: "Photographed pages" },
  { icon: Highlighter, label: "Readings", note: "Marked-up chapters" },
  { icon: FileSpreadsheet, label: "Problem sets", note: "Worked examples" },
] as const;

export function FormatsStrip() {
  return (
    <section className="border-t border-border">
      <div className={FRAME}>
        <div className="px-5 py-8 sm:px-8">
          <p className="text-center font-mono text-[11px] tracking-[0.14em] text-foreground/35 uppercase">
            Bring whatever you were given
          </p>
        </div>

        <motion.div
          variants={listContainer}
          initial="hidden"
          whileInView="visible"
          viewport={REVEAL_VIEWPORT}
          className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6"
        >
          {FORMATS.map((format, index) => (
            <motion.div
              key={format.label}
              variants={listItem}
              className={cn(
                "group flex flex-col gap-2 border-border p-5 transition-colors hover:bg-muted/50",
                // Right rule on every cell but the last in its row, at each
                // breakpoint. Written out because the column count changes
                // three times and `:last-child` only knows about one of them.
                "border-r [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(3n)]:border-r lg:[&:nth-child(6n)]:border-r-0",
                // Bottom rule on every row but the last — which is a different
                // row at each breakpoint, since the grid goes 2 → 3 → 6 across.
                index < 4 ? "border-b" : "",
                index < 3 ? "sm:border-b" : "sm:border-b-0",
                "lg:border-b-0",
              )}
            >
              <format.icon className="size-4 text-foreground/40 transition-colors group-hover:text-primary" />
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  {format.label}
                </p>
                <p className="mt-0.5 text-[11.5px] text-foreground/40">
                  {format.note}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
