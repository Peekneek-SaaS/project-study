import { BoardsView } from "@/features/board/views/boards-view";

// The filter lives in the query string, so the index is rendered per request
// and can warm the list the URL actually asks for.
const BoardPage = (props: PageProps<"/board">) => {
  return <BoardsView searchParams={props.searchParams} />;
};

export default BoardPage;
