import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import MainSidebar from "@/features/main/components/main-sidebar";

import MainHeader from "@/features/main/components/main-header";
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

  // The paywall provider is at the root rather than here: the settings dialog
  // is mounted up there beside the pages, and it shows the plan and the credit
  // meter. See `app/layout.tsx`.
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <MainSidebar />
      {/*
        `min-w-0` on both, and load-bearing rather than tidy: this inset is a
        flex item beside the sidebar, so its automatic minimum size is whatever
        is inside it. A page with something wider than the screen — the todo
        board's fortnight of columns — would otherwise widen the inset itself,
        push the header and the sidebar around, and leave the page scrolling
        sideways instead of the scroller inside it.
      */}
      <SidebarInset className="min-w-0">
        <MainHeader />
        <main className="flex min-w-0 flex-1 flex-col">
          {/*
            No `HydrateClient` here. The layout warms nothing, so it would have
            nothing of its own to hand over — and being an ancestor of the page,
            it dehydrates the shared request cache while the page's prefetch is
            still in it, snapshotting a query mid-flight. Each view wraps its
            own already-awaited prefetch instead.

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
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default MainLayout;
