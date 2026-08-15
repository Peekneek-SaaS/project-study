import BoardView from "@/features/board/views/board-view";

const BoardCanvasPage = async ({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) => {
  const { boardId } = await params;

  return <BoardView boardId={boardId} />;
};

export default BoardCanvasPage;
