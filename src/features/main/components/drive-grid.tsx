"use client";

import { DriveDocumentCard } from "@/features/main/components/drive-document-card";
import { DriveFolderCard } from "@/features/main/components/drive-folder-card";
import { DriveParentCard } from "@/features/main/components/drive-parent-card";
import type { SelectRow } from "@/features/main/hooks/use-drive-row-interaction";
import type { DriveDocument, DriveFolder } from "@/features/main/types";

/**
 * The drive as cards.
 *
 * Split into folders and files the way the table orders them — folders first —
 * so the two views agree about what "the next item" means: the arrow keys and
 * shift-click walk the same sequence in both.
 */
export function DriveGrid({
  folders,
  documents,
  isRoot,
  parentFolderId,
  onSelect,
}: {
  folders: DriveFolder[];
  documents: DriveDocument[];
  isRoot: boolean;
  parentFolderId: string | null;
  onSelect: SelectRow;
}) {
  return (
    <div className="flex flex-col gap-6">
      {!isRoot && <DriveParentCard parentFolderId={parentFolderId} />}

      {folders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Folders
          </h2>
          <div
            role="listbox"
            aria-multiselectable
            aria-label="Folders"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          >
            {folders.map((folder) => (
              <DriveFolderCard
                key={folder.id}
                folder={folder}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      )}

      {documents.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Files
          </h2>
          <div
            role="listbox"
            aria-multiselectable
            aria-label="Files"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {documents.map((doc) => (
              <DriveDocumentCard key={doc.id} doc={doc} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
