"use client";

import { LayoutGrid, List } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DriveViewType,
  useDriveView,
  useDriveViewStore,
} from "@/lib/stores/drive-view-store";

/**
 * List or grid, for the drive table below.
 *
 * Only the tab strip: there is no `TabsContent` because the two views are not
 * panels sitting inside this component — `MainContent` renders whichever the
 * store names, several levels down.
 */
const MainViewType = ({ serverView }: { serverView: DriveViewType }) => {
  const view = useDriveView(serverView);
  const setView = useDriveViewStore((state) => state.setView);

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as DriveViewType)}
    >
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

export default MainViewType;
