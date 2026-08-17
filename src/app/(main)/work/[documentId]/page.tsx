import type { Metadata } from "next";

import { WorkView } from "@/features/work/views/work-view";
import { getQueryClient, trpc } from "@/trpc/server";

/** The document's own name in the tab — see the board page for how and why. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string }>;
}): Promise<Metadata> {
  const { documentId } = await params;

  const document = await getQueryClient()
    .fetchQuery(trpc.document.getWorkspace.queryOptions({ id: documentId }))
    .catch(() => null);

  return { title: document?.name ?? "Document" };
}

const WorkPage = async ({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) => {
  const { documentId } = await params;

  return <WorkView documentId={documentId} />;
};

export default WorkPage;
