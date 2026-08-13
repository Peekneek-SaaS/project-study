import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Spinner } from "@/components/ui/spinner";

/**
 * Shell shared by every preview route.
 *
 * The boundary and the fallback sit here rather than around the viewer so a
 * preview is all-or-nothing: a half-drawn header above an error card reads as
 * a broken document rather than one you are not allowed to see.
 *
 * Full viewport height, because the document is the page.
 */
const PreviewLayout = ({ children }: LayoutProps<"/preview">) => {
  return (
    <div className="flex h-dvh flex-col">
      <QueryErrorBoundary
        message="This document could not be loaded."
        className="flex-1 justify-center"
      >
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          }
        >
          {children}
        </Suspense>
      </QueryErrorBoundary>
    </div>
  );
};

export default PreviewLayout;
