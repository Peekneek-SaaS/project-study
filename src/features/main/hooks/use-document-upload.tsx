"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { UploadProgressToast } from "@/features/main/components/upload-progress-toast";
import {
  selectCurrentFolderId,
  useDriveStore,
} from "@/lib/stores/drive-store";
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const folderId = useDriveStore(selectCurrentFolderId);

  // The upload outlives the modal that started it, and progress arrives after
  // every render the callbacks were created in — refs keep both stable.
  const toastId = useRef<string | number | null>(null);
  const label = useRef("");

  const dismissProgressToast = () => {
    if (toastId.current !== null) toast.dismiss(toastId.current);
    toastId.current = null;
  };

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    // 1% steps: the default "coarse" granularity moves the bar in visible jumps.
    uploadProgressGranularity: "fine",

    onUploadProgress: (progress) => {
      if (toastId.current === null) return;
      // Re-issuing under the same id replaces the toast's contents in place.
      toast.custom(
        () => <UploadProgressToast label={label.current} progress={progress} />,
        { id: toastId.current, duration: Infinity },
      );
    },

    onClientUploadComplete: async () => {
      // A new toast rather than an update of the progress one: sonner merges
      // updates onto the existing toast, so the custom body would survive and
      // the success toast would render the finished bar with the tick above it.
      dismissProgressToast();
      toast.success(`Uploaded ${label.current}`, { duration: 4000 });
      // The whole router, not just the listing: the search palette's flat index
      // is a `folder` query too, and it holds its answer for minutes.
      await queryClient.invalidateQueries(trpc.folder.pathFilter());
    },

    onUploadError: (error) => {
      dismissProgressToast();
      toast.error(`Could not upload ${label.current}`, {
        description: error.message,
        duration: 6000,
      });
    },
  });

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      label.current = batchLabel(files);
      toastId.current = toast.custom(
        () => <UploadProgressToast label={batchLabel(files)} progress={0} />,
        { duration: Infinity },
      );

      await startUpload(files, { folderId });
    },
    [folderId, startUpload],
  );

  return { upload, isUploading };
}
