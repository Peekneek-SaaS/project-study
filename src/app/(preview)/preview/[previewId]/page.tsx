import { PreviewView } from "@/features/main/views/preview-view";

const PreviewPage = async ({ params }: PageProps<"/preview/[previewId]">) => {
  const { previewId } = await params;

  return <PreviewView documentId={previewId} />;
};

export default PreviewPage;
