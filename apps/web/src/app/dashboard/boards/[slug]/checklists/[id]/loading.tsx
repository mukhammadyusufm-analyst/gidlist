import { LoadingRegion, PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * A single checklist, which opens with a back link, its avatar and title, a
 * version badge and its own tab strip. Those sit above every tab beneath it, so
 * they belong in this loader rather than in each one.
 */
export default function ChecklistLoading() {
  return (
    <LoadingRegion>
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />

        <div className="flex gap-3">
          <Skeleton className="size-11 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>

        <div className="flex gap-1 border-b border-[var(--color-border)] pb-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>

        <PageSkeleton rows={5} />
      </div>
    </LoadingRegion>
  );
}
