"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";

import { driveFolderParsers } from "@/features/main/lib/params";
import { DRIVE_PATH } from "@/features/main/types";
import { useTRPC } from "@/trpc/client";

/**
 * The `folder` param, with the history behaviour navigation wants.
 *
 * `push`, not the `replace` nuqs defaults to: walking into a folder is a place
 * you can come back from, and the browser's own Back is the control everybody
 * already knows. `replace` would make Back leave the drive entirely from three
 * folders deep.
 *
 * Built once at module scope rather than inline in the hook. `withOptions`
 * returns a new parser object each time it is called, and this hook is mounted
 * by a dozen components at once — handing each of them a fresh identity on
 * every render is churn for nothing.
 */
const FOLDER_PARAM = driveFolderParsers.folder.withOptions({
  history: "push",
});

/** One folder on the way down from the root. */
export interface DriveCrumb {
  id: string;
  name: string;
}

/**
 * Walking the drive, and where "which folder is open" actually lives.
 *
 * The URL holds it — `/main?folder=<id>` — and the trail of names above it is
 * `folder.getBreadcrumb`, cached like any other query. That split is the whole
 * design, and it is worth saying why it is not one store:
 *
 * The *id* is the only thing needed to render a listing, and it has to be known
 * before the first render or the server prefetches the wrong folder. A URL
 * param is readable synchronously on both sides, so it is. The *names* are only
 * needed by the breadcrumb bar, they are not derivable from an id without
 * asking, and they can arrive a moment later without anything being wrong.
 *
 * This replaced a zustand store that held both. The store was memory, so a
 * reload dropped the trail and dumped you at the root however deep you had
 * walked — which is the bug this exists to fix. It also meant no folder had an
 * address: nothing could be shared, bookmarked, or backed out of.
 *
 * Nothing here subscribes to anything. The trail is read out of the query cache
 * at click time rather than watched, so navigating does not re-render every row
 * that happens to be able to navigate — the same reason the selection handlers
 * read their store with `getState()`.
 */
export function useDriveNavigation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  // Compared rather than pushed blindly — see `goToFolder`.
  const pathname = usePathname();

  const [folderId, setFolderId] = useQueryState("folder", FOLDER_PARAM);

  /** The trail as it stands, read rather than subscribed to. */
  const readTrail = useCallback(
    (id: string | null): DriveCrumb[] =>
      queryClient.getQueryData<DriveCrumb[]>(
        trpc.folder.getBreadcrumb.queryKey({ folderId: id }),
      ) ?? [],
    [queryClient, trpc],
  );

  /**
   * Opens a folder by id, from anywhere in the app.
   *
   * The branch is what lets the create dialog and the search palette send you
   * to a folder from the boards or the notes page. On the drive this is a query
   * -string change and nothing re-renders on the server; anywhere else there is
   * no `folder` param to set — setting one would write `?folder=…` onto
   * `/board` — so the destination is built as a whole URL instead.
   */
  const goToFolder = useCallback(
    (id: string | null) => {
      if (pathname !== DRIVE_PATH) {
        router.push(
          id
            ? `${DRIVE_PATH}?folder=${encodeURIComponent(id)}`
            : DRIVE_PATH,
        );
        return;
      }
      void setFolderId(id);
    },
    [pathname, router, setFolderId],
  );

  /**
   * Writes a trail into the cache under the folder it ends at.
   *
   * This is what keeps the breadcrumb instant. Without it, arriving in a folder
   * means its `getBreadcrumb` is uncached, so the bar would empty out and refill
   * a round trip later — every single time you open a folder. We already know
   * every name on the way down, so the answer is put where the query will look
   * for it and the refetch behind it only ever confirms what is shown.
   */
  const seedTrail = useCallback(
    (trail: DriveCrumb[]) => {
      queryClient.setQueryData(
        trpc.folder.getBreadcrumb.queryKey({
          folderId: trail.at(-1)?.id ?? null,
        }),
        trail,
      );
    },
    [queryClient, trpc],
  );

  /** Descend one level, into a folder in the listing on screen. */
  const openFolder = useCallback(
    (child: DriveCrumb) => {
      seedTrail([...readTrail(folderId), child]);
      goToFolder(child.id);
    },
    [folderId, goToFolder, readTrail, seedTrail],
  );

  /**
   * Jump straight to a folder several levels down, with its path already known.
   *
   * For the search palette, which can land anywhere. The trail is given whole
   * rather than walked into, so the crumbs describe the path to the folder
   * rather than the route the user did not take to get there.
   */
  const openTrail = useCallback(
    (trail: DriveCrumb[]) => {
      seedTrail(trail);
      goToFolder(trail.at(-1)?.id ?? null);
    },
    [goToFolder, seedTrail],
  );

  /**
   * Steps out of a folder that has stopped existing.
   *
   * A no-op unless it is the folder you are standing in or one above it, which
   * beats browsing a listing whose folder was just deleted from under it. Lands
   * on its parent rather than the root, so deleting a subfolder leaves you
   * where you were working.
   */
  const leaveFolder = useCallback(
    (id: string) => {
      const trail = readTrail(folderId);
      const index = trail.findIndex((crumb) => crumb.id === id);
      if (index === -1) return;

      goToFolder(trail[index - 1]?.id ?? null);
    },
    [folderId, goToFolder, readTrail],
  );

  /**
   * Relabels a folder wherever it appears in a cached trail.
   *
   * The rename already invalidates the whole `folder` router, so this is not
   * what makes the new name stick — it is what makes it appear *now* rather
   * than after the refetch, on a crumb the user is looking at as they rename
   * it. Every cached trail, not just the open one, because the folder renamed
   * may be an ancestor of others still in the cache.
   */
  const renameCrumb = useCallback(
    (id: string, name: string) => {
      queryClient.setQueriesData<DriveCrumb[]>(
        trpc.folder.getBreadcrumb.queryFilter(),
        (trail) =>
          trail?.map((crumb) =>
            crumb.id === id ? { ...crumb, name } : crumb,
          ),
      );
    },
    [queryClient, trpc],
  );

  return {
    /** Folder being browsed, or `null` at the root. */
    folderId,
    goToFolder,
    openFolder,
    openTrail,
    leaveFolder,
    renameCrumb,
  };
}

/**
 * The trail to the open folder, for the breadcrumb bar.
 *
 * A plain query rather than a suspense one: the crumbs are a label on the
 * listing, not the listing, and a bar that is briefly one crumb short is far
 * better than a bar that can suspend a tree it does not own — this renders
 * outside the drive's own `<Suspense>`, so suspending here would blank the
 * page rather than the table.
 *
 * In practice it is never short. `useDriveBrowser` reads the same key with
 * `useSuspenseQuery`, so the drive itself does not render until the trail is in
 * the cache, and navigation seeds it before the URL even changes.
 *
 * Reads the param directly rather than going through `useDriveNavigation`: this
 * one only needs to know where it is, and that hook also wires up a router and
 * a pathname it would have no use for.
 */
export function useDriveTrail(): DriveCrumb[] {
  const trpc = useTRPC();
  const [folderId] = useQueryState("folder", driveFolderParsers.folder);

  const { data } = useQuery(
    trpc.folder.getBreadcrumb.queryOptions({ folderId }),
  );

  return data ?? [];
}
