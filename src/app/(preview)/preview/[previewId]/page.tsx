import type { Metadata } from "next";

import { PreviewView } from "@/features/main/views/preview-view";
import { getQueryClient, trpc } from "@/trpc/server";

/** The document's own name in the tab — see the board page for how and why. */
export async function generateMetadata({
  params,
}: PageProps<"/preview/[previewId]">): Promise<Metadata> {
  const { previewId } = await params;

  const document = await getQueryClient()
    .fetchQuery(trpc.document.getPreview.queryOptions({ id: previewId }))
    .catch(() => null);

  return { title: document?.name ?? "Document" };
}

const PreviewPage = async ({ params }: PageProps<"/preview/[previewId]">) => {
  const { previewId } = await params;

  return <PreviewView documentId={previewId} />;
};

export default PreviewPage;
