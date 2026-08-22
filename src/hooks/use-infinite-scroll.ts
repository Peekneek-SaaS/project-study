"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * How far below the fold the sentinel starts asking for the next page.
 *
 * The whole design of an infinite list is that the next page is already there
 * by the time you reach it, so the trigger has to fire *before* the sentinel is
 * visible. 400px is roughly a screenful of rows at these sizes — enough that a
 * normal scroll never catches the loader, close enough that a list nobody is
 * scrolling does not quietly fetch itself in the background.
 */
const ROOT_MARGIN = "0px 0px 400px 0px";

/**
 * Watches an element and asks for the next page when it comes near.
 *
 * An observer rather than a scroll listener, and that is not merely tidier:
 * these lists live in three different scrollports — the page for the drive and
 * the boards, the chat page's own column, and a resizable panel on the work
 * page — and a scroll handler would have to be told which one it is measuring
 * against. `IntersectionObserver` with a null root walks up and finds it.
 *
 * The observer is rebuilt whenever `hasNextPage` changes, which is also how it
 * stops: at the end of a list there is nothing to observe and the sentinel is
 * left alone rather than firing into a query that will refuse it.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  /*
    The live answers, read at fire time rather than closed over.

    The observer is created once per `hasNextPage` change, but it fires whenever
    the sentinel drifts into range — which during a fetch is every scroll event.
    Closing over `isFetchingNextPage` would freeze it at whatever it was when
    the observer was built, and a stale `false` there is a page requested over
    and over while the first one is still in flight.
  */
  const state = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage });
  useEffect(() => {
    state.current = { hasNextPage, isFetchingNextPage, fetchNextPage };
  });

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (!entries[0]?.isIntersecting) return;

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = state.current;
    if (!hasNextPage || isFetchingNextPage) return;

    void fetchNextPage();
  }, []);

  useEffect(() => {
    const node = ref.current;
    // Nothing to watch at the end of the list — see above.
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(onIntersect, {
      rootMargin: ROOT_MARGIN,
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [hasNextPage, onIntersect]);

  return ref;
}
