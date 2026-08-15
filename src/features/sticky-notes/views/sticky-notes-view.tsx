import { Suspense } from "react";
import type { SearchParams } from "nuqs/server";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { NoteCreateButton } from "@/features/sticky-notes/components/note-create-button";
import { NotesGrid } from "@/features/sticky-notes/components/notes-grid";
import { NotesGridSkeleton } from "@/features/sticky-notes/components/notes-grid-skeleton";
import { loadNoteFilters } from "@/features/sticky-notes/lib/params";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

/**
 * The sticky notes page.
 *
 * Only standalone notes are listed, which is all the router will return — the
 * per-document ones will arrive beside their document rather than here.
 *
 * Laid out like the drive and the boards, down to the sticky measurements: the
 * same title bar that stays put and the same toolbar parked under it. The
 * variables those offsets read are declared here — see `main-view.tsx`, which
 * explains what each one is and why they are classes rather than a `style`
 * prop. No third offset: a wall of cards has no column headings to pin.
 */
export async function StickyNotesView({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Read here as well as in the toolbar so the wall warmed below is the one the
  // client is about to ask for; prefetching the unfiltered wall instead would
  // hydrate under a key nothing looks up.
  const filters = await loadNoteFilters(searchParams);

  prefetch(trpc.stickyNote.list.queryOptions(filters));

  return (
    <div className="relative flex flex-1 flex-col gap-2 p-4 [--drive-sticky-top:4rem] [--drive-title-h:3rem] [--drive-toolbar-h:3rem] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--drive-sticky-top:3rem]">
      <div className="sticky top-(--drive-sticky-top) z-30 -mx-4 flex h-(--drive-title-h) items-center justify-between gap-3 bg-background px-4">
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
