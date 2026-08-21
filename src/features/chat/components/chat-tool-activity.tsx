"use client";

import { getToolName, type ToolUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  ChevronRight,
  Loader2,
  PencilLine,
  Search,
} from "lucide-react";
import { useState } from "react";

import { DURATION, EASE_OUT, fastTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * What the model did before it answered.
 *
 * Shown rather than hidden, because in a chat whose whole promise is "answers
 * from your documents" the searching *is* the evidence. A user watching it look
 * through Biology and land on chapter 4 has a reason to believe the citation
 * that follows; the same answer with no visible work behind it asks to be taken
 * on trust.
 *
 * Collapsed by default all the same. It is reassurance, not the answer, and it
 * should never be what the eye lands on first.
 */

/** The passage shape the tools return — see `chat/server/tools.ts`. */
interface Passage {
  document?: string;
  section?: string | null;
  pageStart?: number;
  pageEnd?: number;
  text?: string;
}

/** One thing the user wrote, as `readWorkspace` hands it back. */
interface WorkspaceResult {
  kind?: string;
  title?: string;
  document?: string;
  page?: number;
  quote?: string;
  text?: string;
  due?: string;
  done?: boolean;
}

interface ToolOutput {
  found?: number;
  passages?: Passage[];
  items?: WorkspaceResult[];
}

/**
 * Which of the three tools this is.
 *
 * Named rather than tested inline, because every branch below asks the same
 * question and a fourth tool should be one line here rather than five string
 * comparisons scattered through the file.
 */
type Step = "search" | "read" | "workspace";

function stepOf(part: ToolUIPart): Step {
  switch (getToolName(part)) {
    case "readDocumentPages":
      return "read";
    case "readWorkspace":
      return "workspace";
    default:
      return "search";
  }
}

/** "page 5", or "pages 4–5". The em dash is the range, not a hyphen. */
function pageLabel(passage: Passage): string | null {
  const { pageStart, pageEnd } = passage;
  if (typeof pageStart !== "number") return null;
  if (typeof pageEnd !== "number" || pageEnd === pageStart) {
    return `page ${pageStart}`;
  }
  return `pages ${pageStart}–${pageEnd}`;
}

/** English, for a count that is usually not one. */
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The one-line summary of a step, written in the tense it is in.
 *
 * Present continuous while it runs and past once it is done, because that is
 * the difference between "this is happening" and "this happened" — and a list
 * of finished steps all saying "Searching…" reads as a stuck chat.
 *
 * The workspace line says "you wrote" on purpose. It is the same distinction
 * the prompt spends a paragraph on — the user's own work is not the document's
 * — and a reader watching the assistant work should be able to see which of the
 * two it just went and looked at.
 */
function summarise(part: ToolUIPart): string {
  const step = stepOf(part);
  const running =
    part.state !== "output-available" && part.state !== "output-error";

  if (running) {
    const query = (part.input as { query?: string } | undefined)?.query;
    if (step === "read") return "Reading pages…";
    if (step === "workspace") {
      return query
        ? `Looking through your notes for “${query}”…`
        : "Looking through your notes and todos…";
    }
    return query ? `Searching for “${query}”…` : "Searching your documents…";
  }

  if (part.state === "output-error") {
    if (step === "read") return "Could not read those pages";
    if (step === "workspace") return "Could not read your notes";
    return "That search failed";
  }

  const output = part.output as ToolOutput | undefined;
  const found =
    output?.found ?? output?.passages?.length ?? output?.items?.length ?? 0;

  if (step === "read") return `Read ${plural(found, "passage")}`;
  if (step === "workspace") {
    return found === 0
      ? "Found nothing you had written about that"
      : `Read ${plural(found, "thing")} you wrote`;
  }
  if (found === 0) return "Found nothing for that search";
  return `Found ${plural(found, "passage")}`;
}

/**
 * A workspace item as two lines: what it is, and what it says.
 *
 * The heading carries whatever locates it — the document, the page, the day it
 * is due — because "Osmosis recap" on its own is not enough to recognise a note
 * by three weeks later, which is the same reason the annotation keeps its
 * quote.
 */
function workspaceLabel(item: WorkspaceResult): string {
  const parts = [item.document];

  if (typeof item.page === "number") parts.push(`page ${item.page}`);
  if (item.due) parts.push(item.done ? `done · ${item.due}` : `due ${item.due}`);

  return [item.title, ...parts.filter(Boolean)].join(" · ");
}

export function ChatToolActivity({ part }: { part: ToolUIPart }) {
  const [isOpen, setIsOpen] = useState(false);

  const isRunning =
    part.state !== "output-available" && part.state !== "output-error";

  const output = part.output as ToolOutput | undefined;
  const passages = output?.passages ?? [];
  const items = output?.items ?? [];
  const canExpand = passages.length > 0 || items.length > 0;

  const step = stepOf(part);
  const Icon =
    step === "read" ? BookOpen : step === "workspace" ? PencilLine : Search;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fastTransition}
      className="my-1"
    >
      <button
        type="button"
        // Not a button at all when there is nothing behind it — a control that
        // does nothing when pressed is worse than plain text.
        disabled={!canExpand}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1 text-start text-xs text-muted-foreground transition-colors",
          canExpand && "hover:text-foreground",
        )}
      >
        {isRunning ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <Icon className="size-3.5 shrink-0" />
        )}

        <span className="min-w-0 truncate">{summarise(part)}</span>

        {canExpand && (
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && canExpand && (
          <motion.div
            // Height is animated from `auto`, which Motion measures for us. The
            // overflow clip is what stops the contents spilling out during the
            // frames where the box is shorter than they are.
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            {/* One list, whichever kind of result filled it. The two shapes
                are laid out identically — a heading that locates the thing and
                two lines of what it says — so a chat that searched a document
                and then read a note does not change format between the two. */}
            <ul className="mt-1 flex flex-col gap-1.5 border-s ps-3">
              {passages.map((passage, index) => (
                <li key={index} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {[passage.document, passage.section, pageLabel(passage)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {passage.text && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {passage.text}
                    </span>
                  )}
                </li>
              ))}

              {items.map((item, index) => (
                <li key={index} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {workspaceLabel(item)}
                  </span>
                  {(item.quote ?? item.text) && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.quote ? `“${item.quote}”` : item.text}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
