import type { Metadata } from "next";

import { TodoView } from "@/features/todo/views/todo-view";

export const metadata: Metadata = { title: "Todo" };

// The filters live in the query string, so the page is rendered per request and
// can warm the tasks the URL actually asks for.
const TodoPage = (props: PageProps<"/todo">) => {
  return <TodoView searchParams={props.searchParams} />;
};

export default TodoPage;
