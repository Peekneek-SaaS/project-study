"use client";

import { LayoutGrid, List } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type TodoViewType as TodoViewValue,
  useTodoView,
  useTodoViewStore,
} from "@/lib/stores/todo-view-store";

/**
 * List or grid, sat next to the page title the way the drive's switch is.
 *
 * Only the tab strip: there is no `TabsContent`, because the two views are not
 * panels inside this component — `TodoBoard` draws whichever the store names,
 * from inside the suspense boundary below.
 *
 * The choice is kept in a cookie rather than in the URL, so it is still the
 * chosen one on the next visit and so the server can render it — the drive's
 * arrangement, and `todo-view-store` says why.
 */
const TodoViewType = ({ serverView }: { serverView: TodoViewValue }) => {
  const view = useTodoView(serverView);
  const setView = useTodoViewStore((state) => state.setView);

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as TodoViewValue)}>
      <TabsList variant="custom">
        <TabsTrigger value="list">
          <List />
          List
        </TabsTrigger>
        <TabsTrigger value="grid">
          <LayoutGrid />
          Grid
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default TodoViewType;
