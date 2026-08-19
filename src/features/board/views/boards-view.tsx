import { Suspense } from "react";
import * as motion from "motion/react-client";
import type { SearchParams } from "nuqs/server";

import { fade, mountAnimation } from "@/lib/motion";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { BoardCreateButton } from "@/features/board/components/board-create-button";
import { BoardsTable } from "@/features/board/components/boards-table";
import { BoardsTableSkeleton } from "@/features/board/components/boards-table-skeleton";
import { loadBoardFilters } from "@/features/board/lib/params";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * The boards index.
 *
 * Only standalone boards are listed, which is all the router will return — the
 * per-document ones will arrive beside their document rather than here.
 *
 * Laid out like the drive, down to the sticky measurements: the same title bar
 * that stays put, the same toolbar parked under it, the same column headings
 * under that. The variables those offsets read are declared here — see
 * `main-view.tsx`, which explains what each one is and why they are classes
 * rather than a `style` prop.
 */
export async function BoardsView({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Read here as well as in the toolbar so the list warmed below is the one the
  // client is about to ask for; prefetching the unfiltered list instead would
  // hydrate under a key nothing looks up.
  const filters = await loadBoardFilters(searchParams);

  // `prefetchAwaited`, never bare `prefetch`. The bare one hands the query to
  // the dehydrator and returns, so `HydrateClient` snapshots it mid-flight —
  // and this app has no streamed-hydration provider to deliver the result
  // afterwards. The client then hydrates a query that claims to be fetching
  // with nothing actually in flight, and `useSuspenseQuery` waits on a promise
  // that will never arrive: the page hangs on its skeleton until a reload,
  // where a full server render resolves it the ordinary way.
  await prefetchAwaited(trpc.board.list.queryOptions(filters));

  return (
    <div className="relative flex flex-1 flex-col gap-2 px-4 [--drive-sticky-top:4rem] [--drive-title-h:3rem] [--drive-toolbar-h:3rem] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--drive-sticky-top:3rem]">
      {/* `motion/react-client` so a server component can animate — see
          `main-view.tsx` for the whole of why. */}
      <motion.div
        {...mountAnimation}
        variants={fade}
        className="sticky top-(--drive-sticky-top) z-30 -mx-4 flex h-(--drive-title-h) items-center justify-between gap-3 bg-background px-4"
      >
        <h1 className="text-lg font-semibold sm:text-xl ">Boards</h1>
        <BoardCreateButton />
      </motion.div>

      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading your boards.">
          <Suspense fallback={<BoardsTableSkeleton />}>
            <BoardsTable />
          </Suspense>
        </QueryErrorBoundary>
      </HydrateClient>
    </div>
  );
}
