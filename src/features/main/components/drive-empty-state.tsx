"use client";

import { useTransition } from "react";
import { FolderIcon, SearchXIcon } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { driveFilterParsers } from "@/features/main/lib/params";
import { useModalStore } from "@/lib/stores/modal-store";

export function DriveEmptyState({
  isRoot,
  isFiltering,
}: {
  isRoot: boolean;
  /** Whether a filter is what emptied the listing, rather than the folder. */
  isFiltering: boolean;
}) {
  const openModal = useModalStore((state) => state.open);
  // In a transition for the same reason the toolbar's setter is: clearing the
  // filters refetches the listing, and this button sits inside the boundary
  // that would otherwise blank out under it. See `main-filter-view`.
  const [, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(driveFilterParsers, {
    history: "replace",
    startTransition,
  });

  // A filtered-away listing is not an empty folder, and offering an upload
  // there answers a question nobody asked — the way out is the filter.
  if (isFiltering) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Nothing matches these filters</EmptyTitle>
          <EmptyDescription>
            There is nothing of that kind here. Try a wider filter, or clear
            them to see everything in this folder.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            onClick={() => setFilters({ type: null, modified: null })}
          >
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderIcon />
        </EmptyMedia>
        <EmptyTitle>
          {isRoot ? "No files yet" : "This folder is empty"}
        </EmptyTitle>
        <EmptyDescription>
          Upload a file to start studying, or drag files in from another folder.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => openModal("upload-file")}>Upload file</Button>
      </EmptyContent>
    </Empty>
  );
}
