import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * A space, which always opens with its banner and tab strip.
 *
 * Drawn separately from the generic dashboard skeleton because those two
 * elements are the tallest things on the page: leaving them out would make the
 * real page arrive as a jump rather than a fade.
 */
export default function SpaceLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="aspect-[3/1] w-full rounded-xl" />

      <div className="flex gap-1 border-b border-[var(--color-border)] pb-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>

      <PageSkeleton rows={4} />
    </div>
  );
}
