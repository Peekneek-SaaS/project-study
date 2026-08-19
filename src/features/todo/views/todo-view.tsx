import { Suspense } from "react";
import * as motion from "motion/react-client";
import type { SearchParams } from "nuqs/server";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { TodoBoard } from "@/features/todo/components/todo-board";
import { TodoBoardSkeleton } from "@/features/todo/components/todo-board-skeleton";
import { loadTodoFilters, toListInput } from "@/features/todo/lib/params";
import { readTodoViewCookie } from "@/features/todo/lib/read-todo-view-cookie";
import TodoViewType from "@/features/todo/components/todo-view-type";
import { fade, mountAnimation } from "@/lib/motion";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * The todo page.
 *
 * The one page in the app that scrolls inside itself rather than scrolling the
 * window, and that is not a style choice — it is what makes this page open on
 * today every single time.
 *
 * The window's scroll position does not belong to whoever is rendering: the
 * router puts every navigation back at the top of the document, and the browser
 * restores an old offset on reload and on going back. A page that has an
 * opinion about where it starts is therefore in a race with both of them, and
 * racing was exactly what kept losing — the anchor would fire, and something
 * after it would put the page back at the top, which on a list ordered
 * future-first is a fortnight away from today.
 *
 * With the scrolling in a container the page owns, there is no race left to
 * lose. Nothing outside this subtree can reach that container's `scrollTop`, it
 * starts at zero on every arrival, and the anchor sets it before the first
 * paint — so arriving from another page, coming back, reloading, and switching
 * views all land in the same place, and a reader who scrolled to next Tuesday
 * before leaving gets today back rather than wherever they were.
 *
 * The measurements follow from that. The page claims the viewport minus the app
 * header — the one sticky thing still above it, which shrinks with the sidebar,
 * hence the `md:` override — and inside the scroller the sticky region starts at
 * its own top, so `--drive-sticky-top` is nothing. The title bar and the toolbar
 * park against that, and the day sections offset their scroll target by the sum,
 * which is what stops the day being scrolled to from landing underneath them.
 */
export async function TodoView({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The remembered layout, so the first paint is already the right one. The
  // client store reads the same cookie — see `useTodoView`.
  const serverView = await readTodoViewCookie();

  // Read here as well as in the toolbar so the list warmed below is the one the
  // client is about to ask for; prefetching the unfiltered list instead would
  // hydrate under a key nothing looks up.
  const filters = await loadTodoFilters(searchParams);

  // `prefetchAwaited`, never bare `prefetch` — the whole of why is written out
  // in `trpc/server.tsx`, and the symptom is a page that hangs on its skeleton
  // until it is reloaded.
  await prefetchAwaited(trpc.todo.list.queryOptions(toListInput(filters)));

  return (
    // The page's own height, and `overflow-hidden` so nothing can escape it and
    // give the window something to scroll after all. `min-h-0` and `min-w-0`
    // because this is a flex item in two directions' worth of flex containers,
    // and a flex item is as big as its content until it is told otherwise.
    <div className="flex h-[calc(100svh-var(--drive-header-h))] min-h-0 min-w-0 flex-col overflow-hidden [--drive-header-h:4rem] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--drive-header-h:3rem]">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-4 [--drive-sticky-top:0rem] [--drive-title-h:3rem] [--drive-toolbar-h:3rem]">
        {/* `motion/react-client` so a server component can animate — see
            `main-view.tsx` for the whole of why. */}
        <motion.div
          {...mountAnimation}
          variants={fade}
          className="sticky top-(--drive-sticky-top) z-30 -mx-4 flex h-(--drive-title-h) items-center justify-between gap-3 bg-background px-4"
        >
          <h1 className="text-lg font-semibold sm:text-xl">Todo</h1>
          <TodoViewType serverView={serverView} />
        </motion.div>

        <HydrateClient>
          <QueryErrorBoundary message="Something went wrong loading your tasks.">
            <Suspense fallback={<TodoBoardSkeleton />}>
              <TodoBoard serverView={serverView} />
            </Suspense>
          </QueryErrorBoundary>
        </HydrateClient>
      </div>
    </div>
  );
}
