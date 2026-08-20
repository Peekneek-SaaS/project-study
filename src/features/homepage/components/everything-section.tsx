"use client";

import {
  CalendarDays,
  FolderTree,
  Keyboard, 
  Lock,
  Moon,
  PanelsTopLeft,
  PictureInPicture2,
  Search,
  Share2,
} from "lucide-react";

import {
  Eyebrow,
  Reveal,
  RevealGroup,
  RevealItem,
  SectionHeading,
} from "@/features/homepage/components/homepage-primitives";
import { FRAME } from "@/features/homepage/lib/design";
import { cn } from "@/lib/utils";

/**
 * The long tail, and the numbers.
 *
 * Deliberately *not* usage statistics. The reference can put "357M API
 * calls/week" on its page because it has them; inventing the equivalent here
 * would be the one thing on this page that stops being true the moment someone
 * checks. These four count what the product is made of instead, which is both
 * honest and — for a visitor deciding whether one upload is worth it —
 * genuinely the more useful number.
 */
const COUNTS = [
  { value: "5", label: "surfaces per document", note: "reader · board · notes · tasks · chat" },
  { value: "3", label: "models behind every answer", note: "with automatic failover" },
  { value: "3", label: "file types, no conversion", note: "PDF · DOCX · PPTX" },
  { value: "0", label: "plugins or setup", note: "upload and it is running" },
] as const;

const FEATURES = [
  {
    icon: FolderTree,
    title: "Folders that nest",
    body: "A real tree, not a flat list with tags bolted on. Term, module, week — however you already think about it.",
  },
  {
    icon: Search,
    title: "Search everything at once",
    body: "One box over every folder, document, note and task you own. It opens with results already in it.",
  },
  {
    icon: PictureInPicture2,
    title: "Float the document",
    body: "Minimise the page into a window that hovers over the canvas, so the board gets the full width and the figure stays visible.",
  },
  {
    icon: PanelsTopLeft,
    title: "The split remembers you",
    body: "Drag the divider once. Every document you open sits where you left it, from the very first paint.",
  },
  {
    icon: CalendarDays,
    title: "A calendar that counts",
    body: "Tasks land on days, days get dots, and the month tells you where the week is going before you open it.",
  },
  {
    icon: Share2,
    title: "Share a read-only link",
    body: "Send someone the document without sending them the file, or your notes, or your account.",
  },
  {
    icon: Lock,
    title: "Locked by default",
    body: "Documents and folders start private. Nothing is shared because you forgot to check a box.",
  },
  {
    icon: Moon,
    title: "Light and dark, properly",
    body: "Not a filter over a light theme. Both are designed, and the app follows your system unless you say otherwise.",
  },
  {
    icon: Keyboard,
    title: "Built to be lived in",
    body: "Square edges, dense type, no animation that makes you wait. It is a tool you have open for four hours, not a demo.",
  },
] as const;

export function EverythingSection() {
  return (
    <section id="everything" className="scroll-mt-16 border-t border-border">
      <div className={FRAME}>
        {/* ---- The counts ---- */}
        <RevealGroup className="grid border-b border-border sm:grid-cols-2 lg:grid-cols-4">
          {COUNTS.map((count, index) => (
            <RevealItem
              key={count.label}
              className={cn(
                "border-b border-border p-6 last:border-b-0 sm:border-b-0",
                index < COUNTS.length - 1 ? "lg:border-r" : "",
                index === 0 ? "sm:border-r sm:border-b" : "",
                index === 1 ? "sm:border-b lg:border-b-0" : "",
                index === 2 ? "sm:border-r lg:border-b-0" : "",
              )}
            >
              {/* The rule down the left of a number is the reference's tell for
                  a statistic. Kept, because it works — it turns four numbers in
                  a row into four *entries* rather than a scoreboard. */}
              <div className="border-l-2 border-primary pl-4">
                <p className="text-[clamp(2rem,3.5vw,2.75rem)] leading-none font-semibold tracking-[-0.04em] text-foreground">
                  {count.value}
                </p>
                <p className="mt-2 text-[13px] font-medium text-foreground/70">
                  {count.label}
                </p>
                <p className="mt-1 font-mono text-[10.5px] text-foreground/30">
                  {count.note}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* ---- The long tail ---- */}
        <div className="px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <Eyebrow>Everything else</Eyebrow>
            <SectionHeading
              className="mt-6"
              lead="The hundred small things."
              rest="The ones you never notice until you use something that got them wrong."
            />
          </Reveal>
        </div>

        <RevealGroup className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <RevealItem
              key={feature.title}
              className={cn(
                "group flex flex-col gap-3 border-b border-border p-6 transition-colors hover:bg-muted/40",
                // The right-hand rule, dropped at the end of each row so it
                // never doubles the frame's own edge.
                "sm:[&:nth-child(2n+1)]:border-r lg:[&:nth-child(2n+1)]:border-r-0",
                "lg:[&:nth-child(3n+1)]:border-r lg:[&:nth-child(3n+2)]:border-r",
                index >= FEATURES.length - 3 ? "lg:border-b-0" : "",
              )}
            >
              <feature.icon className="size-4 text-foreground/35 transition-colors group-hover:text-primary" />
              <p className="text-[14px] font-medium text-foreground">
                {feature.title}
              </p>
              <p className="text-[12.5px] leading-relaxed text-foreground/45">
                {feature.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
