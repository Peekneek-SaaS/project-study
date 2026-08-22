"use client";

import { motion } from "motion/react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  Palette,
  Underline,
} from "lucide-react";
import type { ReactNode } from "react";

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
 *
 * The bodies are formatted rather than plain, and each note carries one thing
 * the editor can actually do — bold and italic, a bulleted list, a link, a
 * highlight and an underline, a numbered list at a larger size. One apiece and
 * no more: a wall where every note is a formatting sample reads as a test page,
 * and the claim being made is "your notes can look like notes", not "look how
 * many buttons there are".
 *
 * What is shown is exactly what the editor supports — see `note-html.ts`, whose
 * allowlist is the real limit. It is rich text and not Markdown, so there are
 * no headings, quotes or code blocks to show; putting one here would be
 * advertising a button that does not exist.
 *
 * The strip along the bottom is the other half of "Note it": an annotation, on
 * the page it was written on. It is here rather than in a sixth tab because the
 * copy beside this mockup now claims both, and a claim with no picture under it
 * is the one thing a page like this cannot afford. It also fills the room the
 * wall was leaving empty below "Yesterday".
 */
/**
 * A note as the wall draws it.
 *
 * `body` is a node rather than a string because the whole point of this pass is
 * that a note is formatted text. Typed explicitly instead of inferred from an
 * `as const`, which cannot hold JSX without widening everything around it.
 */
interface MockNote {
  tint: string;
  ink: string;
  title: string;
  body: ReactNode;
  tag: string | null;
  /**
   * Dropped below `md`.
   *
   * The breakpoint is `md` and not `sm` because of what happens *just above*
   * `sm`: the wall goes to three columns there, so every note is a third of a
   * narrow panel wide and wraps to more lines than it does at any other size.
   * That is the tallest this mockup ever gets, and it is the width where the
   * whole wall was appearing at once. Everything comes back at `md`, where
   * there is finally room for it.
   */
  narrowHidden?: boolean;
}

interface MockDay {
  day: string;
  narrowHidden?: boolean;
  items: MockNote[];
}

/**
 * Shared shapes for the marks inside a note.
 *
 * Written once so the five notes cannot drift into five slightly different
 * yellows. `HIGHLIGHT` is the product's own first highlighter — `#fff176`, from
 * `NOTE_HIGHLIGHTS` — as a literal for the reason that file gives: the hex is
 * written into the note's own HTML, so it is the same colour wherever the note
 * is read, and a token here would quietly be a different mark.
 *
 * No horizontal padding on it, which is not an oversight. A real mark is a
 * `background-color` on a span, and the browser paints that tight to the
 * glyphs; padding pushed the sentence's full stop a visible step away from the
 * word it belongs to, which is the one detail that would give the mockup away.
 */
const HIGHLIGHT = "bg-[#fff176]";
/** Matches the link styling the real editor applies inside a note body. */
const LINK = "font-medium text-blue-700 underline underline-offset-2";
/** Lists, at the scale this mockup runs at rather than the editor's own. */
const LIST = "mt-1 space-y-0.5 ps-3.5";

const NOTES: MockDay[] = [
  {
    day: "Today",
    items: [
      {
        tint: "bg-[oklch(0.94_0.075_85)]",
        ink: "text-[oklch(0.32_0.06_60)]",
        title: "Osmosis ≠ diffusion",
        // Bold and italic, the two most ordinary things anybody does to a
        // sentence — and the pair that makes a note read as written rather
        // than as typed into a box.
        body: (
          <>
            Osmosis is <strong className="font-semibold">water only</strong>, and
            only across a semipermeable membrane. Diffusion is{" "}
            <em className="italic">any solute</em>.
          </>
        ),
        tag: "p. 12",
      },
      {
        tint: "bg-[oklch(0.93_0.055_155)]",
        ink: "text-[oklch(0.3_0.05_155)]",
        title: "Exam trap",
        body: (
          <>
            They always ask about plant cells:
            <ul className={cn(LIST, "list-disc")}>
              <li>Wall holds the pressure → turgid</li>
              <li>An animal cell bursts instead</li>
            </ul>
          </>
        ),
        tag: "p. 13",
      },
      {
        tint: "bg-[oklch(0.93_0.05_255)]",
        ink: "text-[oklch(0.3_0.05_255)]",
        title: "Ask in seminar",
        body: (
          <>
            Does aquaporin density change the rate, or only the ceiling?{" "}
            <span className={LINK}>the 2019 review</span>
          </>
        ),
        tag: null,
        // The third note is a second row once the wall falls to two columns,
        // and that row is exactly the height the annotation strip needs. Two
        // notes still read as a wall; a strip cut off halfway does not read as
        // anything.
        narrowHidden: true,
      },
    ],
  },
  {
    day: "Yesterday",
    /*
      Dropped on a phone, and not for tidiness.

      The panel is a fixed 400px at every width, and at 375 the wall falls to
      two columns — so five notes plus the annotation strip do not fit, and what
      does not fit is silently cut off at the bottom. That was already true of
      this group before the strip existed: the heading rendered and its notes
      did not, which reads as a bug rather than as a crop.

      One full day plus the annotation is the honest version of the same
      picture. The bullets beside it still say notes are grouped by day, and
      "Today" is a group.
    */
    narrowHidden: true,
    items: [
      {
        tint: "bg-[oklch(0.93_0.05_25)]",
        ink: "text-[oklch(0.33_0.06_25)]",
        title: "Isotonic ≈ no net flow",
        // The highlighter goes on the pale red paper on purpose: the product's
        // yellow is invisible on the amber note and obvious on this one, which
        // is the same reason the real palette is five colours and not one.
        body: (
          <>
            Still moving both ways —{" "}
            <span className={HIGHLIGHT}>net zero, not stopped</span>.{" "}
            <span className="underline underline-offset-2">Wording matters.</span>
          </>
        ),
        tag: "p. 11",
      },
      {
        tint: "bg-[oklch(0.94_0.04_310)]",
        ink: "text-[oklch(0.32_0.05_310)]",
        title: "Redo Fig 4.3",
        body: (
          <>
            {/* One run at a larger size, which is the other thing the
                appearance controls do to a selection. */}
            <span className="text-[11.5px] font-medium">Before the test:</span>
            <ol className={cn(LIST, "list-decimal")}>
              <li>Copy the arrows onto the board</li>
              <li>Label both gradients</li>
            </ol>
          </>
        ),
        tag: null,
      },
    ],
  },
];

export function NotesMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-none border border-border bg-card",
        className,
      )}
    >
      {/*
        The formatting bar a note gets when it is open.

        The same six the real toolbar carries, in the same order — see
        `note-format-toolbar` — plus the highlighter, which lives with the
        appearance controls rather than beside them. It is worth matching
        exactly: this row is the promise the notes underneath are keeping, and
        an icon here with no button behind it in the product is a small lie
        told in a picture.
      */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border bg-muted/50 px-2.5">
        {[Bold, Italic, Underline, List, ListOrdered, Link2, Palette].map(
          (Icon, index) => (
            <span
              key={index}
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-none",
                // The highlighter reads as armed, because one of the notes
                // below is marked with it.
                index === 6
                  ? "bg-background text-foreground"
                  : "text-foreground/40",
              )}
            >
              <Icon className="size-3" />
            </span>
          ),
        )}
        {/* Gone below `sm`: seven icons and a caption do not both fit a phone,
            and the caption is the half that is only decoration. */}
        <span className="ml-auto hidden truncate font-mono text-[9.5px] text-foreground/35 sm:inline">
          5 notes · this document
        </span>
      </div>

      {/*
        `space-y-3`, not the 4 it was.

        The lists made two of the notes a line taller, which pushed the
        annotation strip ten pixels past the bottom of this fixed-height panel.
        The room comes out of the gaps between the three groups rather than out
        of a note, because a wall reads as a wall at either spacing and a strip
        cut off at the ankles reads as broken.
      */}
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
        {NOTES.map((group) => (
          <div
            key={group.day}
            className={group.narrowHidden ? "hidden md:block" : undefined}
          >
            <p className="mb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-foreground/30 uppercase">
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
                    "flex flex-col gap-1 rounded-none border border-black/5 p-2 shadow-sm",
                    note.tint,
                    note.narrowHidden && "hidden md:flex",
                  )}
                >
                  <p className={cn("text-[10.5px] font-semibold", note.ink)}>
                    {note.title}
                  </p>
                  {/*
                    `opacity-80`, not the 70 it was.

                    Opacity makes a group, so a child cannot be more opaque than
                    its parent — at 70 the highlighter came out a washed cream
                    rather than a yellow, which is exactly the one mark that has
                    to look like itself. 80 still sets the body below the title
                    without draining the marks inside it.

                    `leading-[1.5]` for the same reason the annotation strip
                    runs loose: a highlight needs room to sit behind the words
                    without touching the line above.
                  */}
                  <div
                    className={cn(
                      "text-[9.5px] leading-[1.5] opacity-80",
                      note.ink,
                    )}
                  >
                    {note.body}
                  </div>
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

        <AnnotationStrip />
      </div>
    </div>
  );
}

/**
 * A note written onto the page, rather than filed beside it.
 *
 * Deliberately drawn as a fragment of a page and not as another card: the whole
 * distinction being made is that this kind of note has a *place*, and a card
 * would say the opposite. The highlight sits on the words, the marker sits at
 * the end of them, and the note hangs off the marker — which is exactly the
 * arrangement in the product.
 *
 * The prose is the same passage the notes above are about, so the strip reads
 * as the same person working on the same page rather than as a second example.
 */
function AnnotationStrip() {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-foreground/30 uppercase">
        Annotation
      </p>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        // A tenth rather than the usual four, because this sits at the very
        // bottom of a panel with a fixed height: on a short viewport the strip
        // may never be 40% in view, and a reveal that never fires is an empty
        // box where the illustration should be.
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col gap-2 rounded-none border border-border bg-background p-3 sm:flex-row sm:gap-3"
      >
        {/* The page fragment. `leading-[1.7]` so the highlight has room to sit
            behind the words without touching the line above it. */}
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] leading-[1.7] text-foreground/45">
            Water moves from a region of higher water potential to one of{" "}
            <span className="bg-yellow-300/60 px-0.5 text-foreground/75">
              lower water potential across a semipermeable membrane
            </span>
            {/*
              The marker, at the end of the selection — the dot you click on the
              real page to read what was written there.

              Inline rather than absolutely positioned on the highlight. A
              highlight that wraps is two line boxes, and an absolute child
              resolves against the first of them — which put the marker in the
              middle of the sentence, on the word the reader is trying to read.
              As an inline sibling it simply follows the last word, wherever
              that lands.
            */}
            <span className="ms-0.5 inline-grid size-3 translate-y-[-3px] place-items-center rounded-full bg-yellow-500 align-middle text-[6px] font-bold text-white">
              1
            </span>
            , which is the definition the paper asks for.
          </p>
        </div>

        {/* The note hanging off it. */}
        {/* Under the page on a phone, beside it once there is room — a note
            pinned to a 38% column at 300px wide is four words a line. */}
        <div className="shrink-0 border-t border-border pt-2 sm:w-[38%] sm:border-t-0 sm:border-s sm:pt-0 sm:ps-3">
          <p className="flex items-center gap-1 text-[9px] font-semibold text-foreground/70">
            <MessageSquareText className="size-2.5 text-yellow-600" />
            Page 12
          </p>
          <p className="mt-1 text-[9px] leading-[1.45] text-foreground/45">
            This is the wording to memorise — not the one in the lecture slides.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
