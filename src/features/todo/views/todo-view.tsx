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
 * Laid out like the drive and the notes wall, down to the sticky measurements:
 * the same title bar that stays put and the same toolbar parked under it. The
 * variables those offsets read are declared here — see `main-view.tsx`, which
 * explains what each one is and why they are classes rather than a `style`
 * prop.
 *
 * The day sections read those same variables for their scroll margin, which is
 * what stops the day this page scrolls itself to from landing underneath the
 * toolbar.
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
    <div className="relative flex flex-1 flex-col gap-2 p-4 [--drive-sticky-top:4rem] [--drive-title-h:3rem] [--drive-toolbar-h:3rem] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--drive-sticky-top:3rem]">
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
  );
}
