"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  CircleDashed,
  FileText,
  MessageSquare,
  Shapes,
  StickyNote,
} from "lucide-react";

import {
  Eyebrow,
  Reveal,
  SectionHeading,
  VisualCaption,
} from "@/features/homepage/components/homepage-primitives";
import { BoardMockup } from "@/features/homepage/components/mockups/board-mockup";
import { ChatMockup } from "@/features/homepage/components/mockups/chat-mockup";
import { NotesMockup } from "@/features/homepage/components/mockups/notes-mockup";
import { ReaderMockup } from "@/features/homepage/components/mockups/reader-mockup";
import { TodoMockup } from "@/features/homepage/components/mockups/todo-mockup";
import { FRAME } from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The five surfaces a document gets, behind one rail.
 *
 * The rail is the reference's signature move and it earns its place here for a
 * reason the reference does not have: this product's pitch is that five tools
 * open around *one* file, and five stacked sections would show five products.
 * A rail that swaps the panel beside it while the heading stays put is the
 * layout arguing the same thing the copy is.
 *
 * Sticky on desktop, a horizontal scroller on mobile — where the panel is
 * already the full width and a fixed rail would eat a third of it.
 */
const SURFACES = [
  {
    id: "read",
    tab: "Read it",
    icon: FileText,
    iconClassName: "fill-orange-400 stroke-orange-200",
    lead: "The page, where you left it.",
    rest: "Open the file and it stays open — the same page, the same scroll, next time you come back. Float it over the canvas when you need the room.",
    points: [
      "PDF, Word and PowerPoint, rendered in the browser",
      "Page rail for the thing you half-remember seeing",
      "Minimise to a floating window instead of closing it",
    ],
    render: () => <ReaderMockup className="h-[400px]" />,
  },
  {
    id: "draw",
    tab: "Draw on it",
    icon: Shapes,
    iconClassName: "fill-purple-500 stroke-purple-500",
    lead: "A canvas that opens beside the page.",
    rest: "Not in another app, not on another tab. Redraw the figure while the figure is still on screen — that is the whole trick to remembering it.",
    points: [
      "A full drawing canvas per document",
      "Saves itself as you work, no save button to forget",
      "Drag the divider to give the board the room it needs",
    ],
    render: () => <BoardMockup className="h-[400px]" />,
  },
  {
    id: "note",
    tab: "Note it",
    icon: StickyNote,
    iconClassName: "fill-yellow-400 stroke-yellow-200",
    lead: "Notes that stay with their source.",
    rest: "Written against the document, filed under the day you wrote them, and still there when you open it three weeks later looking for the one thing you knew you had written down.",
    points: [
      "Rich text, your own paper colour, ink and size",
      "Grouped by the day written, so “Yesterday” means yesterday",
      "Kept with the document, not in a pile with everything else",
    ],
    render: () => <NotesMockup className="h-[400px]" />,
  },
  {
    id: "plan",
    tab: "Plan it",
    icon: CircleDashed,
    iconClassName: "stroke-red-500 stroke-2.5",
    lead: "A reading list, turned into a week.",
    rest: "Tasks written against a document still show up on the day they are due, badged with where they came from — because a planner that hid them would be lying about the day.",
    points: [
      "Filed by due date, with priority and a timer",
      "Badged with the document that produced them",
      "One planner for document work and everything else",
    ],
    render: () => <TodoMockup className="h-[400px]" />,
  },
  {
    id: "ask",
    tab: "Ask it",
    icon: MessageSquare,
    iconClassName: "fill-emerald-500 stroke-emerald-500",
    lead: "Answers with the page number attached.",
    rest: "It searches the passages and reads the pages before it says anything, then shows you which ones. Click the page and the document jumps there.",
    points: [
      "Ask one document, or everything you have ever uploaded",
      "Every claim carries the page it came from",
      "Highlight any answer to keep it as a note, a task, or a reply",
      "Three models behind it — pick one, or let it pick",
    ],
    render: () => <ChatMockup className="h-[400px]" selection />,
  },
] as const;

export function WorkspaceSection() {
  const [active, setActive] = useState<(typeof SURFACES)[number]["id"]>("read");
  const surface = SURFACES.find((item) => item.id === active) ?? SURFACES[0];

  return (
    <section id="workspace" className="scroll-mt-16 border-t border-border">
      <div className={FRAME}>
        {/* The section's claim */}
        <div className="px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <Eyebrow>Workspace</Eyebrow>
            <SectionHeading
              className="mt-6"
              lead="One upload. A whole desk."
              rest="Reader, canvas, notes, planner and AI — open at once, around one file."
            />
          </Reveal>
        </div>

        {/*
          `minmax(0, 1fr)` rather than a bare column on both axes.

          A grid column defaults to `auto`, which sizes to its widest item's
          *max-content* — and the rail below is a row of five `shrink-0`
          buttons that comes to 485px. On a 390px phone that widened the column
          past the viewport and set the whole page scrolling sideways, with the
          rail's own `overflow-x-auto` never getting a chance to do its job.
          Flooring the minimum at zero is what lets the rail scroll inside a
          column that fits.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)] border-t border-border lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* ---- The rail ---- */}
          <div className="border-b border-border lg:border-r lg:border-b-0">
            <div
              className={cn(
                "flex gap-0 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:overflow-visible",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              )}
            >
              {SURFACES.map((item) => {
                const isActive = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(item.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "group relative flex shrink-0 items-center gap-2.5 rounded-none px-5 py-4 text-left text-[14px] font-medium transition-colors sm:px-8 lg:w-full lg:px-6",
                      isActive
                        ? "text-foreground"
                        : "text-foreground/35 hover:text-foreground/70",
                    )}
                  >
                    {/*
                      One bar that travels between the tabs rather than five
                      bars fading in and out. `layoutId` is what makes it the
                      same element in both places, so Motion animates it from
                      the old tab to the new one — the movement is what tells
                      you the panel to the right is about to change.
                    */}
                    {isActive ? (
                      <motion.span
                        layoutId="workspace-rail-indicator"
                        className="absolute inset-y-0 left-0 w-[2px] bg-primary max-lg:inset-x-0 max-lg:top-auto max-lg:bottom-0 max-lg:h-[2px] max-lg:w-auto"
                        transition={{ duration: DURATION.fast, ease: EASE_OUT }}
                      />
                    ) : null}
                    <item.icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive ? item.iconClassName : "text-foreground/25",
                      )}
                    />
                    {item.tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- The panel ---- */}
          <div className="min-w-0 px-5 py-10 sm:px-8 sm:py-12">
            {/*
              `mode="wait"` so the outgoing panel is gone before the next one
              starts. Crossfading two 400px mockups over each other looks like
              a rendering fault, not a transition.
            */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={surface.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.exit, ease: EASE_OUT }}
              >
                <VisualCaption lead={surface.lead} rest={surface.rest} />

                <ul className="mt-6 flex flex-col gap-2 border-l border-border pl-4">
                  {surface.points.map((point) => (
                    <li
                      key={point}
                      className="text-[13px] leading-snug text-foreground/50"
                    >
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">{surface.render()}</div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
