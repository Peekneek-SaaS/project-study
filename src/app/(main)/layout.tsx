import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import MainSidebar from "@/features/main/components/main-sidebar";

import MainHeader from "@/features/main/components/main-header";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { Suspense } from "react";
import { DriveErrorBoundary } from "@/features/main/components/drive-error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { cookies } from "next/headers";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = async ({ children }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // The drive always opens at the root, so its listing can be warmed here and
  // handed to the client already hydrated. Deeper folders are fetched on click.
  prefetch(trpc.folder.getContents.queryOptions({ folderId: null }));

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <MainSidebar />
      <SidebarInset>
        <MainHeader />
        <main className="flex flex-1 flex-col">
          <HydrateClient>
            {/*
              Route-level safety net. The drive draws its own tighter boundaries
              around the table, so this one only catches whatever escapes them.
            */}
            <DriveErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center py-16">
                    <Spinner />
                  </div>
                }
              >
                {children}
              </Suspense>
            </DriveErrorBoundary>
          </HydrateClient>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default MainLayout;
