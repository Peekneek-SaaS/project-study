import { Skeleton } from "@/components/ui/skeleton";

/**
 * What stands in while the days are being fetched.
 *
 * Shaped like the list rather than like a spinner — heading, a couple of rows,
 * an "Add task" — so the page does not visibly rearrange itself the moment the
 * real thing arrives. Three days is enough to fill a screen; the list view is
 * assumed because it is the default, and a skeleton that guessed the axis wrong
 * for one frame is worse than one that is simply approximate.
 */
export function TodoBoardSkeleton() {
  return (
    <div className="flex flex-col gap-8 pt-2">
      {[0, 1, 2].map((day) => (
        <div key={day} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <Skeleton className="size-5 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>

          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 px-1 py-1">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
          ))}

          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
