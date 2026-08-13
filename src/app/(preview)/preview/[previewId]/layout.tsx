import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { documentPreviewPath } from "@/lib/document-links";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

/**
 * Loads the document into the request's query cache and hands it to the client
 * already hydrated, so the view renders on first paint instead of fetching
 * again on mount.
 *
 * This is the first segment that knows *which* document — `previewId` is its
 * own param — so the prefetch cannot move up into `preview/layout.tsx`.
 *
 * Awaited rather than fired and forgotten, unlike the drive's listing: whether
 * this document is yours decides between the page and a 404, and a status code
 * has to be settled before the response starts.
 */
const PreviewDocumentLayout = async ({
  children,
  params,
}: LayoutProps<"/preview/[previewId]">) => {
  const { previewId } = await params;
  const { userId } = await auth();

  // Most likely the owner opening their own link somewhere they are not
  // signed in yet, so send them through and back rather than refusing.
  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(documentPreviewPath(previewId))}`,
    );
  }

  try {
    await getQueryClient().fetchQuery(
      trpc.document.getPreview.queryOptions({ id: previewId }),
    );
  } catch {
    // The procedure answers the same way for a document that does not exist
    // and one that is not yours; both land here.
    notFound();
  }

  return <HydrateClient>{children}</HydrateClient>;
};

export default PreviewDocumentLayout;
