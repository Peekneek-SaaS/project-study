"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDriveStore } from "@/lib/stores/drive-store";

/** The route whose breadcrumbs continue into the drive's folder trail. */
const DRIVE_ROUTE = "/main";

const SEGMENT_LABELS: Record<string, string> = {
  main: "Dashboard",
  board: "Explore Board",
  "text-to-speech": "Text to speech",
};

const toLabel = (segment: string) => {
  const decoded = decodeURIComponent(segment);
  return (
    SEGMENT_LABELS[decoded] ??
    decoded.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
};

interface Crumb {
  key: string;
  label: string;
  /** Route crumbs navigate; folder crumbs only move the drive's trail. */
  href?: string;
  onSelect?: () => void;
}

const MainBreadCrumbs = () => {
  const pathName = usePathname();
  const trail = useDriveStore((state) => state.trail);
  const goToCrumb = useDriveStore((state) => state.goToCrumb);

  const crumbs = React.useMemo<Crumb[]>(() => {
    const segments = pathName.split("/").filter(Boolean);

    const routeCrumbs = segments.map((segment, index) => ({
      key: `route:${index}:${segment}`,
      label: toLabel(segment),
      // Hrefs accumulate from the root, so nested routes keep their prefix.
      href: `/${segments.slice(0, index + 1).join("/")}`,
    }));

    if (pathName !== DRIVE_ROUTE) return routeCrumbs;

    // On the drive, the route crumb doubles as "back to the root folder".
    return [
      ...routeCrumbs.map((crumb) => ({
        ...crumb,
        onSelect: () => goToCrumb(null),
      })),
      ...trail.map((folder) => ({
        key: `folder:${folder.id}`,
        label: folder.name,
        onSelect: () => goToCrumb(folder.id),
      })),
    ];
  }, [goToCrumb, pathName, trail]);

  return (
    <div className="flex items-center gap-2 ">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
      />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;

            return (
              <React.Fragment key={crumb.key}>
                <BreadcrumbItem
                  className={isLast ? undefined : "hidden md:inline-flex"}
                >
                  {isLast ? (
                    <BreadcrumbPage className="max-w-48 truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      {crumb.href ? (
                        <Link
                          href={crumb.href}
                          onClick={crumb.onSelect}
                          className="max-w-48 truncate"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={crumb.onSelect}
                          className="max-w-48 cursor-pointer truncate"
                        >
                          {crumb.label}
                        </button>
                      )}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator className="hidden md:inline-flex" />
                )}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default MainBreadCrumbs;
