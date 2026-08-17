import type { Metadata } from "next";

import BoardView from "@/features/board/views/board-view";
import { getQueryClient, trpc } from "@/trpc/server";

/**
 * The board's own name in the tab, wrapped by the template in the root layout.
 *
 * Fetched through the same query client the page prefetches from, so this costs
 * nothing: the two run in one request, the client is cached per request, and a
 * query fetched here is still fresh when the view asks for it.
 *
 * A board that is missing or is not this user's throws, which is the page's
 * error to report rather than the title's — so this falls back to the generic
 * name and lets the page below say what actually went wrong.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ boardId: string }>;
}): Promise<Metadata> {
  const { boardId } = await params;

  const board = await getQueryClient()
    .fetchQuery(trpc.board.get.queryOptions({ id: boardId }))
    .catch(() => null);

  return { title: board?.name ?? "Board" };
}

const BoardCanvasPage = async ({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) => {
  const { boardId } = await params;

  return <BoardView boardId={boardId} />;
};

export default BoardCanvasPage;
