"use client";

import { DragDropProvider } from "@dnd-kit/react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DriveDocumentRow } from "@/features/main/components/drive-document-row";
import { DriveEmptyState } from "@/features/main/components/drive-empty-state";
import { DriveFolderRow } from "@/features/main/components/drive-folder-row";
import { DriveParentRow } from "@/features/main/components/drive-parent-row";
import { useDriveBrowser } from "@/features/main/hooks/use-drive-browser";
import { driveSensors } from "@/features/main/lib/drive-sensors";
import { cn } from "@/lib/utils";

export function MainContent() {
  const {
    folders,
    documents,
    currentFolderId,
    parentFolderId,
    handleDragEnd,
    isMoving,
  } = useDriveBrowser();

  const isRoot = currentFolderId === null;
  const hasItems = folders.length > 0 || documents.length > 0;

  return (
    <DragDropProvider sensors={driveSensors} onDragEnd={handleDragEnd}>
      <div className={cn(isMoving && "pointer-events-none opacity-60")}>
        <Table>
          {hasItems && (
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {!isRoot && <DriveParentRow parentFolderId={parentFolderId} />}
            {folders.map((folder) => (
              <DriveFolderRow key={folder.id} folder={folder} />
            ))}
            {documents.map((doc) => (
              <DriveDocumentRow key={doc.id} doc={doc} />
            ))}
          </TableBody>
        </Table>
        {!hasItems && <DriveEmptyState isRoot={isRoot} />}
      </div>
    </DragDropProvider>
  );
}
