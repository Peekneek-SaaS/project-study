import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
import type { SearchParams } from "nuqs/server";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { DriveTableSkeleton } from "@/features/main/components/drive-table-skeleton";
import { MainContent } from "@/features/main/components/main-content";
import { loadDriveFilters } from "@/features/main/lib/params";
import { readDriveViewCookie } from "@/features/main/lib/read-drive-view-cookie";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import CreateDropdown from "../components/create-dropdown";
import MainViewType from "../components/main-view-type";
import MainBreadCrumbs from "../components/main-breadcrumbs";

export async function MainView({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The remembered layout, so the first paint is already the right one. The
  // client store reads the same cookie — see `useDriveView`.
  const serverView = await readDriveViewCookie();

  // The filters are read here as well as in the toolbar so the listing warmed
  // below is the one the client is about to ask for. Prefetching the unfiltered
  // root instead would hydrate a listing under a key nothing looks up, and the
  // drive would open on a spinner whenever the URL carried a filter.
  const filters = await loadDriveFilters(searchParams);

  // The drive always opens at the root; deeper folders are fetched on click.
  prefetch(
    trpc.folder.getContents.queryOptions({ folderId: null, ...filters }),
  );

  return (
    /*
      Two bars stay put above the listing — this one and the filter/selection
      toolbar down in `MainContent` — and the second has to know how tall the
      first is to park under it. So the measurements are declared here, once,
      and both read them:

        `--drive-sticky-top`  where the sticky region starts, i.e. the height of
                              the app header, which is itself sticky and shrinks
                              with the sidebar — hence the `md:` override rather
                              than a second copy of that rule further down.
        `--drive-title-h`     this bar's own height, fixed so the toolbar can
                              offset by it. `h-12` is what the tallest thing in
                              it (the view switch, `h-8`) plus the old padding
                              already came to.
        `--drive-toolbar-h`   the toolbar's height, in turn, so the list view's
                              column headings can park under all three.

      Declared as classes rather than a `style` prop because an inline value
      would outrank the `md:` override and the offset would stop following the
      collapsed header.
    */
    <div className="relative flex flex-1 flex-col gap-2 p-4 [--drive-sticky-top:4rem] [--drive-title-h:3rem] [--drive-toolbar-h:3rem] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--drive-sticky-top:3rem]">
      {/*
        Stays put while the listing scrolls under it, so "My Files" and the
        layout switch are always within reach in a long folder. Opaque, because
        rows pass behind it, and stretched back over the page padding with
        `-mx-4` so nothing shows through at the edges.
      */}
      <div className="sticky top-(--drive-sticky-top) z-30 -mx-4 flex h-(--drive-title-h) items-center justify-between gap-3 bg-background px-4">
        <CreateDropdown
          buttonLabel="My Files"
          buttonIconPosition="end"
          buttonIcon={<ChevronDown />}
          buttonVariant="ghost"
          className="sm:text-xl text-lg pl-0!"
        />
        <MainViewType serverView={serverView} />
      </div>

      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading your files.">
          <Suspense fallback={<DriveTableSkeleton serverView={serverView} />}>
            <MainContent serverView={serverView} />
          </Suspense>
        </QueryErrorBoundary>
      </HydrateClient>

      <MainBreadCrumbs />
    </div>
  );
}
