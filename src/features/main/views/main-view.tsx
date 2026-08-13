import { Suspense } from "react";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { DriveTableSkeleton } from "@/features/main/components/drive-table-skeleton";
import { MainActions } from "@/features/main/components/main-actions";
import { MainContent } from "@/features/main/components/main-content";
import { readDriveViewCookie } from "@/features/main/lib/read-drive-view-cookie";

import CreateDropdown from "../components/create-dropdown";
import { ChevronDown } from "lucide-react";
import MainViewType from "../components/main-view-type";
import MainBreadCrumbs from "../components/main-breadcrumbs";

export async function MainView() {
  // The remembered layout, so the first paint is already the right one. The
  // client store reads the same cookie — see `useDriveView`.
  const serverView = await readDriveViewCookie();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 relative">
      <div className="flex items-center justify-between gap-3">
        <CreateDropdown
          buttonLabel="My Files"
          buttonIconPosition="end"
          buttonIcon={<ChevronDown />}
          buttonVariant="ghost"
          className="text-lg"
        />
        <MainViewType serverView={serverView} />
      </div>

      <QueryErrorBoundary message="Something went wrong loading your files.">
        <Suspense fallback={<DriveTableSkeleton serverView={serverView} />}>
          <MainContent serverView={serverView} />
        </Suspense>
      </QueryErrorBoundary>
      <div className="absolute bottom-0 inset-x-0 bg-muted p-3 m-2 rounded-lg shadow-sm ring-1 ring-sidebar-border">
        <MainBreadCrumbs />
      </div>
    </div>
  );
}
