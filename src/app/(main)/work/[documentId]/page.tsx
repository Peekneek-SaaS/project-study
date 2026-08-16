import { WorkView } from "@/features/work/views/work-view";

const WorkPage = async ({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) => {
  const { documentId } = await params;

  return <WorkView documentId={documentId} />;
};

export default WorkPage;
