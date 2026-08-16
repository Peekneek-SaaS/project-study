import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { WorkWorkspace } from "@/features/work/components/work-workspace";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * A document's work page.
 *
 * Given a real height rather than left to `flex-1`, which is the one thing that
 * makes the panels behave. `SidebarProvider` is `min-h-svh`, so the whole shell
 * is content-driven with a viewport *floor* — every height above this point is
 * "as tall as whatever is inside". Left like that, a long list of notes grows
 * the sections panel, which grows the panel group, which stretches the document
 * panel to match and scrolls the window: the notes take the whole page with
 * them instead of scrolling inside their own panel. `min-h-0` cannot fix that,
 * because there is no definite parent height for it to shrink against.
 *
 * So the page claims the viewport minus the header, `overflow-hidden` keeps
 * anything from escaping it, and the only scroller left is the one that should
 * be scrolling. The header's own height is tracked the way `main-view` tracks
 * it — a variable with a sidebar-collapsed variant — so the two cannot drift.
 *
 * No `flex-1` here on purpose: `flex-basis: 0%` would decide the height in a
 * column parent and quietly override the one being set.
 *
 * `prefetchAwaited`, never bare `prefetch`, as everywhere else that warms a
 * query from a server component with nothing else to await. The long version is
 * in `trpc/server.tsx`.
 */
export async function WorkView({ documentId }: { documentId: string }) {
  await prefetchAwaited(trpc.document.getWorkspace.queryOptions({ id: documentId }));

  return (
    <div className="flex min-h-0 flex-col overflow-hidden [--work-header-h:4rem] h-[calc(100svh-var(--work-header-h))] md:group-has-data-[collapsible=icon]/sidebar-wrapper:[--work-header-h:3rem]">
      <HydrateClient>
        <QueryErrorBoundary message="Something went wrong loading this document.">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <WorkWorkspace documentId={documentId} />
          </Suspense>
        </QueryErrorBoundary>
      </HydrateClient>
    </div>
  );
}
