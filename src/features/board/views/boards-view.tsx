import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { BoardCreateButton } from "@/features/board/components/board-create-button";
import { BoardsTable } from "@/features/board/components/boards-table";
import { BoardsTableSkeleton } from "@/features/board/components/boards-table-skeleton";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

/**
 * The boards index.
 *
 * Only standalone boards are listed, which is all the router will return — the
 * per-document ones will arrive beside their document rather than here.
 */
export function BoardsView() {
  prefetch(trpc.board.list.queryOptions());

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold sm:text-xl">Boards</h1>
        <BoardCreateButton />
      </div>

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
