import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { WorkWorkspace } from "@/features/work/components/work-workspace";
import { HydrateClient, prefetchAwaited, trpc } from "@/trpc/server";

/**
 * A document's work page.
 *
 * A column all the way down with `min-h-0` at every step, for the same reason
 * the board page is: Excalidraw sizes itself from its container, so the height
 * has to be a real one by the time it reaches the canvas — and a flex item
 * refuses to be shorter than its content unless told it may.
 *
 * `prefetchAwaited`, never bare `prefetch`, as everywhere else that warms a
 * query from a server component with nothing else to await. The long version is
 * in `trpc/server.tsx`.
 */
export async function WorkView({ documentId }: { documentId: string }) {
  await prefetchAwaited(trpc.document.getWorkspace.queryOptions({ id: documentId }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
