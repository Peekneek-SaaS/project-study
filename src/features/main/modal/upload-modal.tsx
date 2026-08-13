"use client";

import { useRef, useState } from "react";
import { FileText, Plus, UploadCloud, X } from "lucide-react";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDocumentUpload } from "@/features/main/hooks/use-document-upload";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ACCEPT_LABEL,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MAX_FILE_COUNT,
  formatBytes,
  isAcceptedDocument,
} from "@/lib/document-file-types";
import { selectIsOpen, useModalStore } from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";

/** Files carry no id, so name + size + mtime is as close as the browser gets. */
const isSameFile = (a: File, b: File) =>
  a.name === b.name &&
  a.size === b.size &&
  a.lastModified === b.lastModified;

/** Stable across re-renders because the list is deduplicated on these three. */
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export function UploadModal() {
  const isOpen = useModalStore(selectIsOpen("upload-file"));
  const closeModal = useModalStore((state) => state.close);

  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload } = useDocumentUpload();

  const isFull = files.length >= DOCUMENT_MAX_FILE_COUNT;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  /**
   * Adds a picked or dropped selection to the queue.
   *
   * Rejected here as well as on the server so the user finds out before we
   * spend an upload on a file the file route would refuse — and one bad file
   * only costs itself, the rest of the selection still queues.
   */
  const addFiles = (selection: FileList | null) => {
    if (!selection || selection.length === 0) return;

    const rejected: string[] = [];
    const queued = [...files];

    for (const candidate of Array.from(selection)) {
      if (!isAcceptedDocument(candidate)) {
        rejected.push(`${candidate.name} — file type is not supported.`);
        continue;
      }
      if (candidate.size > DOCUMENT_MAX_BYTES) {
        rejected.push(
          `${candidate.name} — ${formatBytes(candidate.size)} is over the ${formatBytes(DOCUMENT_MAX_BYTES)} limit.`,
        );
        continue;
      }
      // Silent: re-picking something already queued is not a mistake worth a
      // message, it just should not queue twice.
      if (queued.some((file) => isSameFile(file, candidate))) continue;
      if (queued.length >= DOCUMENT_MAX_FILE_COUNT) {
        rejected.push(
          `${candidate.name} — only ${DOCUMENT_MAX_FILE_COUNT} files can go up at once.`,
        );
        continue;
      }
      queued.push(candidate);
    }

    setFiles(queued);
    setErrors(rejected);
  };

  const removeFile = (target: File) => {
    setFiles(files.filter((file) => !isSameFile(file, target)));
    setErrors([]);
  };

  const reset = () => {
    setFiles([]);
    setErrors([]);
    setIsDraggingOver(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    reset();
    closeModal();
  };

  // Closes right away: progress belongs to the toast, not a blocked dialog.
  const handleUpload = () => {
    if (files.length === 0) return;
    const pending = files;
    handleOpenChange(false);
    void upload(pending);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Upload files"
      description={`We accept ${DOCUMENT_ACCEPT_LABEL} Up to ${DOCUMENT_MAX_FILE_COUNT} at a time.`}
    >
      <Input
        ref={inputRef}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          // Cleared so re-picking the same file after removing it still fires.
          event.target.value = "";
        }}
      />

      {/*
        The drop target wraps both states, so files can be dropped onto the
        queue as well as onto the empty prompt.
      */}
      <div
        // `min-w-0` because the dialog is a grid: without it a long, unbroken
        // file name sets the column's minimum and widens the whole dialog
        // instead of being truncated.
        className="flex min-w-0 flex-col gap-2"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={(event) => {
          // Moving between children fires `dragleave` on the wrapper too.
          if (event.currentTarget.contains(event.relatedTarget as Node | null))
            return;
          setIsDraggingOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        {files.length > 0 ? (
          <>
            <ul
              className={cn(
                "flex max-h-56 min-w-0 flex-col gap-2 overflow-y-auto rounded-lg",
                isDraggingOver && "ring-2 ring-primary",
              )}
            >
              {files.map((file) => (
                <li
                  key={fileKey(file)}
                  className="flex min-w-0 items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeFile(file)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-muted-foreground">
                {files.length} of {DOCUMENT_MAX_FILE_COUNT} ·{" "}
                {formatBytes(totalBytes)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={openPicker}
                disabled={isFull}
              >
                <Plus className="size-4" />
                Add more
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={openPicker}
            className={cn(
              "flex h-full w-full flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors",
              "hover:border-primary/50 hover:bg-muted/50",
              isDraggingOver && "border-primary bg-muted/50",
            )}
          >
            <UploadCloud className="size-6 text-muted-foreground" />
            <span className="font-medium">Click to choose files</span>
            <span className="text-muted-foreground">or drop them here</span>
          </Button>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-1">
          {errors.map((message) => (
            <li key={message} className="text-destructive">
              {message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleUpload} disabled={files.length === 0}>
          {files.length > 1 ? `Upload ${files.length} files` : "Upload"}
        </Button>
      </div>
    </Modal>
  );
}
