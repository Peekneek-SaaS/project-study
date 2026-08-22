"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  UploadToastProgress,
  UploadToastTitle,
} from "@/features/main/components/upload-progress-toast";
import { useDriveNavigation } from "@/features/main/hooks/use-drive-navigation";
import { usePaywall } from "@/features/billing/hooks/use-paywall";
import { useUploadThing } from "@/lib/uploadthing";
import { useTRPC } from "@/trpc/client";

/** What the toast calls this upload: one name, or a count for a batch. */
const batchLabel = (files: File[]) =>
  files.length === 1 ? files[0].name : `${files.length} files`;

/**
 * Uploads documents to UploadThing and reports progress in a toast.
 *
 * A batch gets one toast, tracking UploadThing's average progress across the
 * files — per-file bars would stack up and bury the page.
 *
 * The document rows are written by the file route's `onUploadComplete`, which
 * runs once per file, so by the time the client hears back
 * (`awaitServerData` defaults to `true`) they exist and the listing only needs
 * invalidating.
 */
export function useDocumentUpload() {
  const { reportError } = usePaywall();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { folderId } = useDriveNavigation();

  // The upload outlives the modal that started it, and progress arrives after
  // every render the callbacks were created in — refs keep both stable.
  const toastId = useRef<string | number | null>(null);
  const label = useRef("");

  /**
   * Puts the upload on screen, or moves the bar it is already showing.
   *
   * A plain loading toast: sonner draws the surface and the spinner, and the
   * name, the percentage and the bar go in as its title and description. Under
   * the same id this updates in place — and because there is no custom body
   * involved, the finish below can turn this very toast into the success one
   * rather than having to replace it.
   */
  const showProgress = (progress: number) => {
    toastId.current = toast.loading(
      <UploadToastTitle label={label.current} progress={progress} />,
      {
        id: toastId.current ?? undefined,
        description: (
          <UploadToastProgress label={label.current} progress={progress} />
        ),
        duration: Infinity,
      },
    );
  };

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    // 1% steps: the default "coarse" granularity moves the bar in visible jumps.
    uploadProgressGranularity: "fine",

    onUploadProgress: (progress) => {
      if (toastId.current === null) return;
      showProgress(progress);
    },

    onClientUploadComplete: async () => {
      toast.success(`Uploaded ${label.current}`, {
        id: toastId.current ?? undefined,
        // Cleared by hand. An update merges onto the toast already on screen,
        // and nothing in a success toast mentions a description — so left
        // alone, the finished bar would ride along underneath the message.
        description: undefined,
        duration: 4000,
      });
      toastId.current = null;
      // The whole router, not just the listing: the search palette's flat index
      // is a `folder` query too, and it holds its answer for minutes.
      await queryClient.invalidateQueries(trpc.folder.pathFilter());
    },

    onUploadError: (error) => {
      /*
        A refusal by the plan is an offer, not just a message.

        `reportError` opens the upgrade dialog when the failure carries a plan
        tag, and hands back the same sentence with the tag stripped. Everything
        else — a network drop, a file the storage rejected — comes back null and
        is reported exactly as before.

        The toast still appears either way. The dialog explains what to do about
        it; the toast is what says which upload it was about, which the dialog
        has no way of knowing.
      */
      const planError = reportError(error);

      // Replaces the bar rather than clearing it, but for the same reason.
      toast.error(
        planError
          ? `${label.current} is more than your plan holds`
          : `Could not upload ${label.current}`,
        {
          id: toastId.current ?? undefined,
          description: planError?.message ?? error.message,
          duration: 6000,
        },
      );
      toastId.current = null;
    },
  });

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      label.current = batchLabel(files);
      showProgress(0);

      await startUpload(files, { folderId });
    },
    [folderId, startUpload],
  );

  return { upload, isUploading };
}
