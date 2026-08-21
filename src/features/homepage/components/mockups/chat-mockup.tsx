"use client";

import { motion } from "motion/react";
import {
  ArrowUp,
  CircleDashed,
  MessageSquare,
  Reply,
  Search,
  StickyNote,
} from "lucide-react";

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
 *
 * `selection` adds the toolbar that appears when you highlight part of an
 * answer. Off by default because the hero's copy of this panel is 290px wide
 * and already carrying the page's first impression; it is switched on for the
 * "Ask it" tab, where there is room to read it.
 */
export function ChatMockup({
  className,
  compact,
  selection,
}: {
  className?: string;
  compact?: boolean;
  /** Show a highlighted passage with the note / todo / reply toolbar over it. */
  selection?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-none border border-border bg-card shadow-lg",
        className,
      )}
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border bg-muted/60 px-2.5">
        <MessageSquare className="size-3 fill-emerald-500 stroke-emerald-500" />
        <span className="text-[10px] font-medium text-foreground/60">
          bio-ch4-final-v2.pdf
        </span>
      </div>

      {/*
        A measure, not the full width of the panel.

        The real transcript pins itself to one column — `CHAT_COLUMN`, about
        ninety characters — and both the answers and the composer are measured
        against it. Without the same limit here the "Ask it" panel stretched
        every answer into a single edge-to-edge line, which reads as a log file
        rather than as a conversation. It has no effect on the narrow hero copy,
        which never reaches the limit.
      */}
      <div
        className={cn(
          "mx-auto w-full flex-1 space-y-2.5 p-2.5",
          compact ? "" : "max-w-lg p-3.5",
        )}
      >
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
          <div className="inline-flex items-center gap-1 rounded-none px-1.5 py-0.5 text-[9.5px] text-foreground/50">
            <Search className="size-2.5" />
            Searched this document
            <span className="font-mono text-foreground/35">8 passages</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-none px-1.5 py-0.5 text-[9.5px] text-foreground/50">
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
          {/*
            The selected passage, and what the product offers to do with it.

            Scoped to the *answer* here for the same reason it is scoped there:
            the real toolbar only appears over text inside an answer, never
            over your own question or the tool activity, because "reply to the
            thing I just typed" means nothing.
          */}
          {/*
            Padding above the line, only when the toolbar is showing.

            The real toolbar floats over whatever happens to be above the
            selection — correct behaviour for a popover, and unavoidable when
            the selection is on the second line of a paragraph. In a still
            screenshot that just reads as two elements colliding, so the mock
            opens a gap for it to land in. `pt-*` rather than `mt-*` because the
            parent's `space-y` already owns these paragraphs' top margins and
            would win the specificity fight.
          */}
          <p className={cn("text-foreground/55", selection ? "pt-8" : undefined)}>
            Plant cells survive it:{" "}
            {/*
              The toolbar lives *inside* the highlighted span, which is what
              makes it point at the right words. Anchored to the paragraph it
              centred itself over the whole line and landed on top of the
              sentence above — the real one is positioned from the selection's
              own bounding box, and this is the static equivalent.

              `inline-block` so the span is a predictable box to position
              against; the phrase is short enough that not breaking inside it
              costs nothing even on a phone.
            */}
            <span
              className={
                selection
                  ? "relative inline-block bg-primary/25 text-foreground"
                  : undefined
              }
            >
              {selection ? <SelectionToolbar /> : null}
              the cell wall holds the pressure
            </span>{" "}
            and the cell becomes turgid instead.
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
          {/* <span className="font-mono text-[9px] text-foreground/35">
            Claude
          </span> */}
          <span className="grid size-4 place-items-center rounded-none bg-primary text-primary-foreground">
            <ArrowUp className="size-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The toolbar that floats over a highlighted answer.
 *
 * The three actions are the product's, in the product's order: keep it as a
 * note, turn it into a task, or quote it back into the composer. The first two
 * are icon-only because they open a modal that names itself; "Reply" carries
 * its label because it is the one that acts immediately, with no confirmation
 * step to explain it afterwards.
 *
 * The icons are deliberately the same marks, in the same colours, as the tabs
 * on the rail beside this panel — a yellow sticky note, a red ring — so the
 * toolbar reads as "send this *there*" rather than as three new symbols.
 *
 * It arrives late and rises the last few pixels into place, which is the shape
 * of the real thing: it is `position: fixed` over the live selection and
 * animates in with the app's `fastTransition` once the range settles.
 */
function SelectionToolbar() {
  return (
    // Every element here is a `span`, deliberately. The toolbar is rendered
    // inside the highlighted phrase so it can be positioned against it, and
    // that phrase lives in a `<p>` — a `<div>` in there is invalid HTML, which
    // React resolves by reparenting the node and then failing to match it on
    // hydration. Absolute positioning and `flex` make these spans lay out as
    // blocks anyway, so nothing is lost by using the legal tag.
    <motion.span
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: DURATION.fast, ease: EASE_OUT, delay: 1.1 }}
      // Above the words it belongs to, the way the real one floats ten pixels
      // clear of the selection rather than pushing the text down.
      className="absolute bottom-full left-1/2 z-10 mb-1.5 flex -translate-x-1/2 items-stretch divide-x divide-border rounded-none border border-border bg-popover shadow-md"
    >
      <span className="grid h-6 w-7 place-items-center">
        <StickyNote className="size-3 fill-yellow-400 stroke-yellow-200" />
      </span>
      <span className="grid h-6 w-7 place-items-center">
        <CircleDashed className="size-3 stroke-red-500 stroke-[2.5]" />
      </span>
      <span className="flex h-6 items-center gap-1 px-2 text-[9.5px] font-medium whitespace-nowrap text-foreground/75">
        <Reply className="size-3" />
        Reply
      </span>
    </motion.span>
  );
}
