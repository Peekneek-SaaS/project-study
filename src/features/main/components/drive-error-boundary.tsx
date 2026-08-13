"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { Button } from "@/components/ui/button";

/**
 * Catches what the suspense query throws.
 *
 * `useQueryErrorResetBoundary` is what makes "Try again" more than a re-render:
 * without it the query stays in its errored state and throws again immediately.
 */
export function DriveErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Something went wrong loading your files."}
          </p>
          <Button variant="outline" onClick={resetErrorBoundary}>
            Try again
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
