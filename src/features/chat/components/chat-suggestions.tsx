"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { fadeUp, listContainer, listItem, mountAnimation } from "@/lib/motion";

interface ChatSuggestionsProps {
  suggestions?: string[];
  onSuggestion?: (question: string) => void;
  className?: string;
}

const ChatSuggestions = ({
  suggestions = [],
  onSuggestion,
  className,
}: ChatSuggestionsProps) => {
  return (
    <motion.div
      {...mountAnimation}
      variants={listContainer}
      className={cn("flex items-center gap-3 text-center", className)}
    >
      {suggestions.length > 0 && onSuggestion && (
        <motion.div
          variants={listContainer}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {suggestions.map((suggestion) => (
            <motion.button
              key={suggestion}
              variants={listItem}
              onClick={() => onSuggestion(suggestion)}
              // Sends immediately rather than filling the box. A suggestion the
              // user has to press and then send again is two actions for
              // something whose entire value is being one.
              className="border bg-card px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
            >
              {suggestion}
            </motion.button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

export default ChatSuggestions;
