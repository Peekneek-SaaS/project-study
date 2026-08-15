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
    <div className="flex flex-1 flex-col gap-2 p-4 relative">
      {/*
        Stays put while the listing scrolls under it, so "My Files" and the
        layout switch are always within reach in a long folder. It sits just
        below the header, which is sticky too and shrinks with the sidebar — so
        the offset follows the same rule the header's own height does. Opaque,
        because rows pass behind it, and stretched back over the page padding
        with `-mx-4` so nothing shows through at the edges.
      */}
      <div className="sticky top-16 z-30 -mx-4 flex items-center justify-between gap-3 bg-background px-4 py-2 md:group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
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
