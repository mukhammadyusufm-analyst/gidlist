import { LoadingRegion, Skeleton, TableSkeleton, TilesSkeleton } from '@/components/ui/skeleton';

/**
 * The heaviest page in the product: a filter panel, four figures, a chart and a
 * paged table, each from its own query. It is also the one most worth drawing
 * accurately — the figures and the chart are tall, and a generic row list would
 * leave the real page arriving as a jump.
 */
export default function ComplianceLoading() {
  return (
    <LoadingRegion>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* The filter panel: presets, then a grid of selects. */}
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4">
          <div className="flex gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>

        <TilesSkeleton />

        <div className="space-y-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <TableSkeleton rows={8} columns={5} />
        </div>
      </div>
    </LoadingRegion>
  );
}
