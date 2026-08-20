"use client";

import { motion } from "motion/react";
import { ArrowUp, Search, Sparkles } from "lucide-react";

import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A conversation held against a document, with its receipts.
 *
 * The tool row above the answer is the honest bit and the reason this mock
 * exists at all: chat here does not answer from a summary it wrote once, it
 * searches the passages and reads the pages, and the transcript says so. The
 * citation chips at the end are links in the product — they open the document
 * panel at that page — so they are drawn as links here.
 */
export function ChatMockup({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-none border border-border bg-card shadow-lg",
        className,
      )}
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border bg-muted/60 px-2.5">
        <Sparkles className="size-3 text-primary" />
        <span className="text-[10px] font-medium text-foreground/60">
          Ask this document
        </span>
      </div>

      <div className={cn("flex-1 space-y-2.5 p-2.5", compact ? "" : "p-3.5")}>
        {/* The question, right-aligned the way the transcript renders it. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          className="flex justify-end"
        >
          <span className="max-w-[85%] rounded-none bg-muted px-2 py-1.5 text-[10.5px] leading-snug text-foreground">
            Why does the cell burst in a hypotonic solution?
          </span>
        </motion.div>

        {/* What it did before it answered. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.25 }}
          className="space-y-1"
        >
          <div className="inline-flex items-center gap-1 rounded-none border border-border bg-background px-1.5 py-0.5 text-[9.5px] text-foreground/50">
            <Search className="size-2.5" />
            Searched this document
            <span className="font-mono text-foreground/35">8 passages</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-none border border-border bg-background px-1.5 py-0.5 text-[9.5px] text-foreground/50">
            Read pages
            <span className="font-mono text-foreground/35">11–13</span>
          </div>
        </motion.div>

        {/* The answer, with the pages it came from. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.5 }}
          className="space-y-1.5 text-[10.5px] leading-[1.6] text-foreground/80"
        >
          <p>
            Water moves <span className="text-foreground">into</span> the cell,
            because the solution outside has a lower solute concentration than
            the cytoplasm. Pressure builds against the membrane until it
            ruptures — lysis.
          </p>
          <p className="text-foreground/55">
            Plant cells survive it: the cell wall holds the pressure and the
            cell becomes turgid instead.
          </p>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="text-[9.5px] text-foreground/35">From</span>
            {["p. 12", "p. 13"].map((page) => (
              <span
                key={page}
                className="rounded-none border border-primary/25 bg-primary/10 px-1 py-px font-mono text-[9px] text-primary"
              >
                {page}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* The composer, with the model picker where it actually sits. */}
      <div className="shrink-0 border-t border-border p-2">
        <div className="flex items-center gap-1.5 rounded-none border border-border bg-background px-2 py-1.5">
          <span className="flex-1 text-[10px] text-foreground/30">
            Ask anything about this document…
          </span>
          <span className="font-mono text-[9px] text-foreground/35">Claude</span>
          <span className="grid size-4 place-items-center rounded-none bg-primary text-primary-foreground">
            <ArrowUp className="size-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
