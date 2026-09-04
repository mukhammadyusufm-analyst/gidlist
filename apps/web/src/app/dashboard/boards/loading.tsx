import { LoadingRegion, PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * Entering a space, when its layout does not exist yet.
 *
 * THIS IS WHERE THE BANNER AND TABS BELONG, and `[slug]/loading.tsx` is where
 * they used to be — which was wrong in a way worth writing down, because the
 * placement rule is easy to get backwards.
 *
 * A `loading.tsx` wraps the *page* of its own segment and everything nested
 * under it. It does not wrap the `layout.tsx` sitting beside it. So the space's
 * own loader renders *inside* the space layout, at a moment when that layout has
 * already drawn the real banner and the real tab strip — and a skeleton banner
 * underneath a real one reads as the page having broken, not as it loading.
 *
 * One level up, here, the `[slug]` layout is itself still being built, so the
 * banner and tabs are genuinely absent and drawing them is honest.
 */
export default function BoardsLoading() {
  return (
    <LoadingRegion>
      <div className="space-y-6">
        <Skeleton className="aspect-[3/1] w-full rounded-xl" />

        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        <div className="flex gap-1 border-b border-[var(--color-border)] pb-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>

        <PageSkeleton rows={4} />
      </div>
    </LoadingRegion>
  );
}
