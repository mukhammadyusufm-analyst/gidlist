import { LoadingRegion, PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * The page most people open every day, and the one where the date picker is the
 * first thing the eye goes to — so it is drawn rather than folded into the
 * generic row list.
 */
export default function FillLoading() {
  return (
    <LoadingRegion>
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Arrow, field, arrow — the row the picker occupies. */}
        <div className="flex items-center gap-2">
          <Skeleton className="size-10 shrink-0" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="size-10 shrink-0" />
        </div>

        <PageSkeleton rows={4} />
      </div>
    </LoadingRegion>
  );
}
