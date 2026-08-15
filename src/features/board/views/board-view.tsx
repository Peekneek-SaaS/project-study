import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

import BoardDynamic from "../components/board-dynamic";

/**
 * One board, filling the page.
 *
 * A column all the way down, because Excalidraw sizes itself from its
 * container: the height has to be a real one by the time it reaches the board,
 * and `min-h-0` is what stops a flex item from refusing to be shorter than the
 * canvas it is meant to be bounding.
 *
 * The scene is fetched here so it is already in the client's cache when the
 * canvas mounts — Excalidraw reads its initial data once and never looks again,
 * so arriving late would mean an empty board that fills in behind the user.
 */
const BoardView = async ({ boardId }: { boardId: string }) => {
  await prefetchAwaited(trpc.board.get.queryOptions({ id: boardId }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading this board.">
          <BoardDynamic boardId={boardId} />
        </QueryErrorBoundary>
      </HydrateClient>
    </div>
  );
};

export default BoardView;
