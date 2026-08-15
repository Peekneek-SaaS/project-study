import { Skeleton } from "@/components/ui/skeleton";

/** The grid's shape while the notes are on their way, so the page does not jump. */
export function NotesGridSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-16" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
