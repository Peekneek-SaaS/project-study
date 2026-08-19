"use client";

import { useTransition } from "react";
import { SearchXIcon } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { MotionEmpty } from "@/components/motion/motion-empty";
import { todoFilterParsers } from "@/features/todo/lib/params";
import { mountAnimation, popIn } from "@/lib/motion";

/**
 * Shown only when a filter has emptied the page.
 *
 * There is no "no todos yet" counterpart, and that is deliberate: an unfiltered
 * todo page is never empty. Every day in the window has a heading and an "Add
 * task" under it, so the page with nothing on it is already the invitation to
 * put something there — an empty state over the top would be covering the thing
 * it was asking the user to do.
 */
export function TodoEmptyState() {
  // In a transition for the same reason the toolbar's setter is: clearing the
  // filter refetches the list, and this button sits inside the boundary that
  // would otherwise blank out under it.
  const [, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(todoFilterParsers, {
    history: "replace",
    startTransition,
  });

  return (
    <MotionEmpty {...mountAnimation} variants={popIn}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>No tasks match these filters</EmptyTitle>
        <EmptyDescription>
          Nothing on any day fits what you are asking for. Try widening it, or
          clear the filters to see every day again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          onClick={() => setFilters({ priority: null, modified: null })}
        >
          Clear filters
        </Button>
      </EmptyContent>
    </MotionEmpty>
  );
}
