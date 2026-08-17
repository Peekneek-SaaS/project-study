"use client";

import { FileText } from "lucide-react";
import Link from "next/link";

import { workPath } from "@/features/work/types";
import { cn } from "@/lib/utils";

/**
 * A citation, drawn as the file it points at.
 *
 * The whole point of the change from prose to this: "according to Biology,
 * chapter 4, page 5" tells you where to look, and then leaves you to go and
 * find it. A chip that looks like a file and opens the document *at that page*
 * closes the gap — checking a claim stops being a task and becomes a click,
 * which is the difference between citations you trust and citations you skim
 * past.
 *
 * Rendered inline, so it sits inside the sentence rather than being collected
 * into a footnote list at the bottom. A citation belongs next to the claim it
 * supports; moved to the end it stops being evidence for any particular
 * sentence.
 */
export function CitationLink({
  documentId,
  page,
  children,
}: {
  documentId: string;
  /** Null where the model cited a document without naming a page. */
  page: number | null;
  /** The model's own wording for the source — the link's visible text. */
  children: React.ReactNode;
}) {
  // The work page rather than the preview: it opens the document beside its
  // board, its notes and its own chat, which is where someone following a
  // citation is most likely to want to carry on.
  const href = page
    ? `${workPath(documentId)}?page=${page}`
    : workPath(documentId);

  return (
    <Link
      href={href}
      // Warmed on hover, like the recents list — following a citation is the
      // single most likely thing to happen next in a cited answer.
      prefetch
      className={cn(
        "mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-md border bg-muted/60 px-1.5 py-0.5 align-baseline",
        "text-[0.8125rem] font-medium text-foreground no-underline",
        "transition-colors hover:border-ring/50 hover:bg-muted",
        // Focus is visible because this is a link inside a paragraph of other
        // links; without a ring, tabbing through an answer gives no sign of
        // where you are.
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/*
        `translate-y` rather than `self-center`: the row is baseline-aligned so
        the text sits on the sentence's baseline, which leaves the icon riding
        high. A nudge is what puts it back on the optical centre of the text.
      */}
      <FileText className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
