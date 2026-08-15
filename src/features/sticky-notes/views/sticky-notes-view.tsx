import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { NoteCreateButton } from "@/features/sticky-notes/components/note-create-button";
import { NotesGrid } from "@/features/sticky-notes/components/notes-grid";
import { NotesGridSkeleton } from "@/features/sticky-notes/components/notes-grid-skeleton";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * The sticky notes page.
 *
 * Only standalone notes are listed, which is all the router will return — the
 * per-document ones will arrive beside their document rather than here.
 */
export async function StickyNotesView() {
  await prefetchAwaited(trpc.stickyNote.list.queryOptions());

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold sm:text-xl">Sticky notes</h1>
        <NoteCreateButton />
      </div>

      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading your notes.">
          <Suspense fallback={<NotesGridSkeleton />}>
            <NotesGrid />
          </Suspense>
        </QueryErrorBoundary>
      </HydrateClient>
    </div>
  );
}
