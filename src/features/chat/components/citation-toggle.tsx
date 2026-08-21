"use client";

import { Link2, Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatCitations } from "@/features/chat/hooks/use-chat-citations";
import { cn } from "@/lib/utils";

/**
 * Turns the citations on an answer off, and back on.
 *
 * In the chat's own bar rather than in a settings page, for the same reason the
 * model picker sits inside the composer: it is a decision made *about the
 * reading you are doing now* — a first pass through unfamiliar material wants
 * every page number, and rereading something you already know wants the prose
 * left alone — and a preference two clicks away in a settings screen would
 * never be used that way.
 *
 * Labelled rather than a bare icon *in the bar*. There is room there, and an
 * unlabelled link-with-a-slash is not a symbol anyone can be expected to read
 * as "citations" the first time they meet it.
 *
 * `labelled={false}` is for the document panel's composer, where it sits in the
 * strip naming the attached file. That strip is a label, not a toolbar, and a
 * button with a word in it there would outweigh the filename it is standing
 * next to. The same call was already made for the model picker one row below —
 * see `ProviderPicker`, whose text is commented out for exactly this reason —
 * so the two quiet controls in that composer stay quiet in the same way.
 *
 * What it changes is what the *next* answer looks like. Answers already in the
 * transcript keep whatever they were written with, and that is deliberate:
 * rewriting history to match a toggle would mean the citations under an answer
 * no longer described the answer above them.
 */
export function CitationToggle({
  className,
  labelled = true,
}: {
  className?: string;
  /** False renders the icon alone. The tooltip still carries the meaning. */
  labelled?: boolean;
}) {
  const [citations, setCitations] = useChatCitations();

  const Icon = citations ? Link2 : Link2Off;
  const label = citations ? "Citations" : "Citations off";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={labelled ? "sm" : "icon-sm"}
          variant="ghost"
          // Icon-only leaves nothing for a screen reader to read out, so the
          // name the sighted user sees in the tooltip becomes the accessible
          // name instead. With the word on screen the attribute would only
          // duplicate it.
          aria-label={labelled ? undefined : label}
          // `aria-pressed` rather than a switch role: this is a button that
          // stays in, which is what a screen reader will announce it as, and it
          // needs no separate label element to say which way it is.
          aria-pressed={citations}
          onClick={() => setCitations(!citations)}
          className={cn(
            "gap-1.5 text-xs",
            citations ? "text-foreground/70" : "text-foreground/40",
            className,
          )}
        >
          <Icon className="size-3.5" />
          {labelled ? <span className="hidden sm:inline">{label}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {citations
          ? "Citations on — answers link to the page they came from. Click to write plain answers instead."
          : "Citations off — answers are written as plain prose. They are still read out of your documents."}
      </TooltipContent>
    </Tooltip>
  );
}
