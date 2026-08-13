"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DriveStatusBadge } from "@/features/main/components/drive-status-badge";
import { LazyPdfViewer } from "@/features/main/components/lazy-pdf-viewer";
import { isPdf } from "@/lib/document-file-types";
import { documentFilePath } from "@/lib/document-links";
import { useTRPC } from "@/trpc/client";

/**
 * A document on its own page.
 *
 * Suspends and throws rather than branching on loading and error states — the
 * preview layout supplies the fallback and the boundary. The record is already
 * in the cache by the time this mounts, so in practice it never suspends on
 * first paint.
 */
export function PreviewView({ documentId }: { documentId: string }) {
  const trpc = useTRPC();
  const { data: doc } = useSuspenseQuery(
    trpc.document.getPreview.queryOptions({ id: documentId }),
  );

  const fileHref = documentFilePath(doc.id);
  const isReady = doc.status === "READY";

  return (
    <>
      <header className="flex min-w-0 items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" asChild aria-label="Back to drive">
          <Link href="/main">
            <ArrowLeft />
          </Link>
        </Button>
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="min-w-0 flex-1 truncate font-medium">{doc.name}</h1>
        {isReady && (
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={fileHref}
              download={doc.name}
              aria-label={`Download ${doc.name}`}
            >
              <Download />
            </a>
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 bg-muted/40">
        {!isReady ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <DriveStatusBadge status={doc.status} />
            <p className="text-muted-foreground">
              This document is not ready to read yet.
            </p>
          </div>
        ) : isPdf(doc.name) ? (
          <LazyPdfViewer url={fileHref} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="font-medium">{doc.name}</p>
            <p className="text-muted-foreground">
              Only PDFs can be read here. Download it to open it.
            </p>
            <Button variant="outline" asChild>
              <a href={fileHref} download={doc.name}>
                <Download />
                Download
              </a>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
