"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Catches what a suspense query throws.
 *
 * `useQueryErrorResetBoundary` is what makes "Try again" more than a re-render:
 * without it the query stays in its errored state and throws again immediately.
 */
export function QueryErrorBoundary({
  children,
  message = "Something went wrong.",
  className,
}: {
  children: React.ReactNode;
  /** Shown when the error itself has nothing readable to say. */
  message?: string;
  className?: string;
}) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div
          className={cn(
            "flex flex-col items-center gap-3 py-16 text-center",
            className,
          )}
        >
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : message}
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
