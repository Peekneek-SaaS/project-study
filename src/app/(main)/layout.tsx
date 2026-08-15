import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import MainSidebar from "@/features/main/components/main-sidebar";

import MainHeader from "@/features/main/components/main-header";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { cookies } from "next/headers";
import MainBreadCrumbs from "@/features/main/components/main-breadcrumbs";
import MainFooter from "@/features/main/components/main-footer";

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

  // The drive's listing is warmed by `MainView` rather than here: it depends on
  // the filters in the query string, which a layout cannot see, and a prefetch
  // under the wrong key hydrates nothing.

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
            <QueryErrorBoundary message="Something went wrong loading your files.">
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center py-16">
                    <Spinner />
                  </div>
                }
              >
                {children}
              </Suspense>
            </QueryErrorBoundary>
          </HydrateClient>
        </main>
      </SidebarInset>
     
    </SidebarProvider>
  );
};

export default MainLayout;
