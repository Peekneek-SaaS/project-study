"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { isTransientStatus } from "@/features/main/lib/document-status";
import { useTRPC } from "@/trpc/client";

/** The listing's rhythm — see `use-drive-browser`, which polls for the same reason. */
const WORKSPACE_POLL_MS = 2_000;

/**
 * The document behind a work page, and the state of the workspace beside it.
 *
 * Three jobs, together because they are the same question asked at different
 * moments: what is here, is it still being built, and if nothing is building it
 * should something be?
 *
 * The last one is what makes documents that predate workspaces work. They are
 * `READY` with no board, which no background job is ever going to fix on its
 * own, so opening the page is what asks for one. It fires once per mount and is
 * guarded by a ref rather than by the mutation's own `isPending`: the refetch
 * that follows re-renders this hook before the status has changed, and a plain
 * pending check would let a second call through in that gap.
 */
export function useDocumentWorkspace(documentId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: workspace } = useSuspenseQuery({
    ...trpc.document.getWorkspace.queryOptions({ id: documentId }),
    refetchInterval: ({ state }) =>
      state.data && isTransientStatus(state.data.status)
        ? WORKSPACE_POLL_MS
        : false,
  });

  const build = useMutation(
    trpc.document.buildWorkspace.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries(
          trpc.document.getWorkspace.queryFilter({ id: documentId }),
        ),
      onError: (error) => toast.error(error.message),
    }),
  );

  // Whether this mount has already asked. Not state: changing it must not cause
  // a render, and it is only ever read by the effect below.
  const hasRequested = useRef(false);

  /**
   * Exactly the legacy case: a document whose file is ready but which has no
   * workspace, because it was uploaded before there were any.
   *
   * `FAILED` is deliberately not included. A build that failed is retried on
   * the button, not on every visit — auto-retrying would replace the
   * explanation with a spinner and quietly re-run a job that may be failing for
   * a reason nobody has looked at yet. `QUEUED` and `BUILDING` already have a
   * run behind them, and `UPLOADING` has no file to build from.
   */
  const needsBuild = workspace.boardId === null && workspace.status === "READY";

  const buildRef = useRef(build.mutate);
  useEffect(() => {
    buildRef.current = build.mutate;
  });

  useEffect(() => {
    if (!needsBuild || hasRequested.current) return;
    hasRequested.current = true;
    buildRef.current({ id: documentId });
  }, [documentId, needsBuild]);

  return {
    workspace,
    /**
     * True from the moment the page decides a build is needed until the board
     * exists — which covers the gap before the mutation has even been sent, so
     * the page never flashes an empty workspace on its way to the building
     * state.
     */
    isBuilding:
      isTransientStatus(workspace.status) ||
      (workspace.boardId === null && workspace.status !== "FAILED"),
    hasFailed: workspace.status === "FAILED",
    retry: () => {
      hasRequested.current = true;
      build.mutate({ id: documentId });
    },
    isRetrying: build.isPending,
  };
}
