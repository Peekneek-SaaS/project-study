"use client";

import { Loader2 } from "lucide-react";

import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

/**
 * The bottom of an endless list.
 *
 * One component for every scrolling list in the app, so they cannot drift: the
 * same trigger distance, the same spinner, the same silence at the end. It is
 * deliberately the *only* loading affordance these lists have — there is no
 * "load more" button behind it, because a button that the scroll position
 * already presses for you is furniture nobody reads.
 *
 * Rendered whether or not there is a next page, and that is on purpose. An
 * element that unmounts at the end of the list takes its own height with it,
 * which snaps the last row up by the height of the spinner exactly as the last
 * page lands. Kept mounted with nothing in it, the list simply stops growing.
 */
export function InfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  className,
  label = "Loading more",
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  className?: string;
  /** What a screen reader is told while a page is on its way. */
  label?: string;
}) {
  const ref = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <div
      ref={ref}
      // `aria-hidden` is wrong here and `role="status"` is the reason: the
      // spinner is a genuine announcement — more of the list is arriving — and
      // a live region is how that reaches someone who cannot see it spin.
      role="status"
      aria-live="polite"
      className={cn(
        "flex h-10 w-full shrink-0 items-center justify-center",
        className,
      )}
    >
      {isFetchingNextPage ? (
        <>
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          {/* Present for screen readers only: the spinner says this to everyone
              else, and a visible "Loading more" under every list is noise. */}
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </div>
  );
}
