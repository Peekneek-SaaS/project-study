"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * One crumb, in the row or in the dropdown.
 *
 * What a crumb does decides its element rather than its styling: a route crumb
 * is a real link and should behave like one, a folder crumb has nowhere to
 * point and is a button.
 *
 * An element rather than a component on purpose — both callers hand this to an
 * `asChild`, which clones what it is given. A component in between would be
 * what got cloned, and the ref and the keyboard props the dropdown injects into
 * its items would stop at its door.
 */
const crumbElement = (crumb: Crumb, className: string) =>
  crumb.href ? (
    <Link href={crumb.href} onClick={crumb.onSelect} className={className}>
      {crumb.label}
    </Link>
  ) : (
    <button type="button" onClick={crumb.onSelect} className={className}>
      {crumb.label}
    </button>
  );

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

  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLOListElement>(null);

  /** How many crumbs after the first are folded away into the dropdown. */
  const [hiddenCount, setHiddenCount] = React.useState(0);

  // The first and the last always stay: one says where the trail starts, the
  // other says where you are.
  const maxHidden = Math.max(0, crumbs.length - 2);

  // Whatever was folded was folded to fit a row that no longer exists, so a
  // resize starts again from the full trail. Watching the container rather than
  // the list keeps folding from feeding back in as another resize.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => setHiddenCount(0));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // A different trail is a different row, so it is measured from scratch —
  // adjusted here rather than in an effect so the unfolded row is what the
  // measuring pass below actually gets to look at.
  const [measured, setMeasured] = React.useState(crumbs);
  if (measured !== crumbs) {
    setMeasured(crumbs);
    setHiddenCount(0);
  }

  // Folds one crumb per pass until the row fits, rather than working out how
  // many it will take: each fold changes the width of what is left — several
  // crumbs become one dropdown button — so only measuring knows. Runs before
  // paint, so the intermediate rows are never seen; `hiddenCount` only climbs,
  // and stops at `maxHidden`.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || hiddenCount >= maxHidden) return;

    // Sub-pixel widths round the two apart on their own.
    if (list.scrollWidth > list.clientWidth + 1) {
      setHiddenCount((count) => count + 1);
    }
  }, [crumbs, hiddenCount, maxHidden]);

  const folded = hiddenCount > 0 ? crumbs.slice(1, 1 + hiddenCount) : [];
  const shown =
    hiddenCount > 0 ? [crumbs[0], ...crumbs.slice(1 + hiddenCount)] : crumbs;

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2 absolute bottom-0 inset-x-0 bg-muted p-3 m-2 rounded-lg shadow-sm ring-1 ring-sidebar-border dark:bg-transparent"
    >
      <Breadcrumb className="min-w-0 flex-1">
        {/*
          `nowrap` and a hidden overflow are what make the row measurable: left
          to wrap, a trail that does not fit becomes two lines rather than an
          overflow, and there is nothing to notice.
        */}
        <BreadcrumbList className="flex-nowrap overflow-hidden">
          {shown.map((crumb, index) => {
            const isLast = index === shown.length - 1;
            // The fold sits between the first crumb and everything kept after
            // it, which is exactly where the trail was cut.
            const foldsAfter = hiddenCount > 0 && index === 0;

            return (
              <React.Fragment key={crumb.key}>
                <BreadcrumbItem className="shrink-0">
                  {isLast ? (
                    <BreadcrumbPage className="max-w-48 truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      {crumbElement(crumb, "max-w-32 cursor-pointer truncate")}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>

                {foldsAfter && (
                  <>
                    <BreadcrumbSeparator className="shrink-0" />
                    <BreadcrumbItem className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          // Sized past the 16px glyph, since this is the one
                          // thing in the row a finger has to find — but not by
                          // much, in a row that is short of space by definition.
                          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          // The ellipsis is decorative, so the button has to
                          // say what it is for itself.
                          aria-label={`Show ${folded.length} more ${folded.length === 1 ? "folder" : "folders"}`}
                        >
                          <BreadcrumbEllipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          // Undoes the trigger-width default: it is sized for
                          // menus that drop from something as wide as they are.
                          className="w-auto min-w-40"
                        >
                          {folded.map((hidden) => (
                            <DropdownMenuItem key={hidden.key} asChild>
                              {crumbElement(
                                hidden,
                                "w-full cursor-pointer truncate",
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                  </>
                )}

                {!isLast && <BreadcrumbSeparator className="shrink-0" />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default MainBreadCrumbs;
